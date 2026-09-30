import { parseFeed } from './parse-feed'
import { RssRepository } from './repository'

type FetchResult =
  | { kind: 'not-modified'; status: 304 }
  | { kind: 'fetched'; status: number; url: string; body: string; contentType: string; etag: string | null; lastModified: string | null }
type FetchFeed = (url: string, conditional: { etag?: string | null; lastModified?: string | null }) => Promise<FetchResult>

export function createRssIngestionService({ repository, fetchFeed }: {
  repository: RssRepository
  fetchFeed: FetchFeed
}) {
  async function connectFeed(url: string, initialMode: 'latest-20' | 'from-now') {
    const response = await fetchFeed(url, {})
    if (response.kind !== 'fetched') throw new Error('UNSUPPORTED_FEED')
    const feed = parseFeed(response.body, response.contentType, response.url)
    const items = [...feed.items]
      .sort((a, b) => (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0))
      .slice(0, 20)

    return repository.transaction(async (client) => {
      const source = await repository.createSource(client, {
        url,
        canonicalUrl: url,
        title: feed.title,
        siteUrl: feed.siteUrl,
        etag: response.etag,
        lastModified: response.lastModified,
      })
      await repository.markSeen(client, source.id, feed.items.map((item) => item.externalId))
      for (const [index, item] of items.entries()) {
        await repository.insertItem(client, source.id, item, true, initialMode === 'latest-20' && index < 3)
      }
      await repository.markSuccess(client, source.id, response.etag, response.lastModified, items.length)
      return source
    })
  }

  async function refreshSource(sourceId: string) {
    const source = await repository.getSource(sourceId)
    if (!source) throw new Error('SOURCE_NOT_FOUND')
    let response: FetchResult
    try {
      response = await fetchFeed(source.url, { etag: source.etag, lastModified: source.lastModified })
    } catch (error) {
      const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : 'FETCH_FAILED'
      await repository.markFailure(sourceId, code, error instanceof Error ? error.message : '抓取失败')
      throw error
    }
    if (response.kind === 'not-modified') {
      await repository.markNotModified(sourceId)
      return { added: 0, revised: 0 }
    }
    const feed = parseFeed(response.body, response.contentType, response.url)
    return repository.transaction(async (client) => {
      await repository.lockSource(sourceId, client)
      let added = 0
      let revised = 0
      for (const item of feed.items) {
        const existing = await repository.findItem(client, sourceId, item.externalId)
        if (!existing) {
          if (await repository.hasSeen(client, sourceId, item.externalId)) continue
          await repository.markSeen(client, sourceId, [item.externalId])
          await repository.insertItem(client, sourceId, item, false, true)
          added += 1
        } else if (existing.current_content_hash !== item.contentHash) {
          await repository.updateItem(client, existing.id, sourceId, item)
          revised += 1
        }
      }
      await repository.markSuccess(client, sourceId, response.etag, response.lastModified, feed.items.length)
      return { added, revised }
    })
  }

  return { connectFeed, refreshSource }
}

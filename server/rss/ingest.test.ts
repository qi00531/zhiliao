// @vitest-environment node
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { createPool } from '../db/pool'
import { migrate } from '../db/migrate'
import { RssRepository } from './repository'
import { createRssIngestionService } from './ingest'

const databaseUrl = process.env.TEST_DATABASE_URL
const describeDatabase = databaseUrl ? describe : describe.skip

function rss(count: number, changed = false) {
  const items = Array.from({ length: count }, (_, index) => {
    const id = count - index
    return `<item><guid>item-${id}</guid><title>Item ${id}</title><link>https://example.com/${id}</link><description>${changed && id === 1 ? 'Changed' : `Summary ${id}`}</description><pubDate>${new Date(Date.UTC(2026, 8, id)).toUTCString()}</pubDate></item>`
  }).join('')
  return `<rss><channel><title>Example</title><link>https://example.com/</link>${items}</channel></rss>`
}

const fetched = (body: string, etag = 'v1') => ({
  kind: 'fetched' as const, status: 200, url: 'https://example.com/feed.xml', body,
  contentType: 'application/rss+xml', etag, lastModified: null,
})

describeDatabase('RSS ingestion', () => {
  const pool = databaseUrl ? createPool(databaseUrl) : null
  const workspaceId = `test-${randomUUID()}`
  const repository = pool ? new RssRepository(pool, workspaceId) : null

  beforeAll(async () => { await migrate(pool!) })
  afterAll(async () => {
    await pool!.query('delete from rss_sources where workspace_id = $1', [workspaceId])
    await pool!.end()
  })

  it('stores twenty baseline items and exposes only the newest three', async () => {
    const fetchFeed = vi.fn(async () => fetched(rss(22)))
    const service = createRssIngestionService({ repository: repository!, fetchFeed })
    const source = await service.connectFeed('https://example.com/feed.xml', 'latest-20')

    expect(await repository!.countItems(source.id)).toBe(20)
    const visible = await repository!.listVisibleItems({ sourceId: source.id })
    expect(visible).toHaveLength(3)
    expect(visible.every((item) => item.initialImport)).toBe(true)
  })

  it('stores a from-now baseline without exposing history', async () => {
    const fetchFeed = vi.fn(async () => fetched(rss(4)))
    const service = createRssIngestionService({ repository: repository!, fetchFeed })
    const source = await service.connectFeed('https://example.com/from-now.xml', 'from-now')
    expect(await repository!.countItems(source.id)).toBe(4)
    expect(await repository!.listVisibleItems({ sourceId: source.id })).toHaveLength(0)
  })

  it('adds one later item idempotently', async () => {
    const fetchFeed = vi.fn()
      .mockResolvedValueOnce(fetched(rss(2), 'v1'))
      .mockResolvedValue(fetched(rss(3), 'v2'))
    const service = createRssIngestionService({ repository: repository!, fetchFeed })
    const source = await service.connectFeed('https://example.com/incremental.xml', 'from-now')
    await service.refreshSource(source.id)
    await service.refreshSource(source.id)
    expect(await repository!.countItems(source.id)).toBe(3)
    expect(await repository!.listVisibleItems({ sourceId: source.id })).toHaveLength(1)
  })

  it('records a revision instead of duplicating a changed item', async () => {
    const fetchFeed = vi.fn()
      .mockResolvedValueOnce(fetched(rss(1), 'v1'))
      .mockResolvedValueOnce(fetched(rss(1, true), 'v2'))
    const service = createRssIngestionService({ repository: repository!, fetchFeed })
    const source = await service.connectFeed('https://example.com/revision.xml', 'from-now')
    await service.refreshSource(source.id)
    expect(await repository!.countItems(source.id)).toBe(1)
    expect(await repository!.countRevisions(source.id)).toBe(2)
  })

  it('does not advance conditional state when fetching fails', async () => {
    const fetchFeed = vi.fn()
      .mockResolvedValueOnce(fetched(rss(1), 'v1'))
      .mockRejectedValueOnce(Object.assign(new Error('offline'), { code: 'FETCH_FAILED' }))
    const service = createRssIngestionService({ repository: repository!, fetchFeed })
    const source = await service.connectFeed('https://example.com/failure.xml', 'from-now')
    await expect(service.refreshSource(source.id)).rejects.toThrow('offline')
    expect((await repository!.getSource(source.id))?.etag).toBe('v1')
  })
})

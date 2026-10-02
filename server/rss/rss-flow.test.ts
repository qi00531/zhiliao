// @vitest-environment node
import { createServer, type Server } from 'node:http'
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildApp } from '../app'
import { AnalysisRepository } from '../ai/repository'
import { createAnalysisWorker } from '../ai/worker'
import { migrate } from '../db/migrate'
import { createPool } from '../db/pool'
import { createFeedFetcher } from './fetch-feed'
import { createRssIngestionService } from './ingest'
import { RssRepository } from './repository'

const databaseUrl = process.env.TEST_DATABASE_URL
const describeDatabase = databaseUrl ? describe : describe.skip

function rss(count: number) {
  const entries = Array.from({ length: count }, (_, index) => {
    const id = count - index
    return `<item><guid>item-${id}</guid><title>Item ${id}</title><link>http://feed.test/${id}</link><description>Summary ${id}</description><pubDate>${new Date(Date.UTC(2026, 8, id)).toUTCString()}</pubDate></item>`
  }).join('')
  return `<rss><channel><title>Fixture Feed</title><link>http://feed.test/</link>${entries}</channel></rss>`
}

describeDatabase('complete RSS flow', () => {
  const pool = databaseUrl ? createPool(databaseUrl) : null
  const workspaceId = `flow-${randomUUID()}`
  let server: Server
  let origin: string
  let body = rss(22)
  let status = 200
  let etag = 'v1'

  beforeAll(async () => {
    await migrate(pool!)
    server = createServer((_request, response) => {
      response.writeHead(status, { 'content-type': 'application/rss+xml', etag })
      response.end(status === 200 ? body : 'failed')
    })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('fixture server unavailable')
    origin = `http://127.0.0.1:${address.port}`
  })

  afterAll(async () => {
    await pool!.query('delete from rss_sources where workspace_id=$1', [workspaceId])
    await pool!.end()
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
  })

  it('connects, adds exactly one later item, preserves evidence, and keeps state after failure', async () => {
    const repository = new RssRepository(pool!, workspaceId)
    const fetchFeed = createFeedFetcher({
      request: fetch,
      urlPolicy: { assertPublicHttpUrl: async () => `${origin}/feed.xml` },
      timeoutMs: 2_000,
      maxBytes: 1_000_000,
    })
    const service = createRssIngestionService({ repository, fetchFeed })
    const analysisRepository = new AnalysisRepository(pool!, workspaceId)
    const analysisWorker = createAnalysisWorker({
      repository: analysisRepository,
      analyzer: { analyze: async () => ({ summary: '摘要', relevance: 'high', reason: '相关', model: 'fixture-model' }) },
      intervalMs: 1_000,
    })
    const app = buildApp({ repository, service, startWorker: false })

    const connected = await app.inject({ method: 'POST', url: '/api/rss/sources', payload: {
      url: 'http://feed.test/feed.xml', initialMode: 'latest-20',
    } })
    expect(connected.statusCode).toBe(201)
    expect(connected.json().initialItems).toHaveLength(3)
    const sourceId = connected.json().source.id as string
    expect(await repository.countItems(sourceId)).toBe(20)

    body = rss(23)
    etag = 'v2'
    expect((await app.inject({ method: 'POST', url: `/api/rss/sources/${sourceId}/run` })).statusCode).toBe(202)
    const items = (await app.inject({ method: 'GET', url: '/api/rss/items' })).json().items
    expect(items).toHaveLength(4)
    expect(items[0]).toMatchObject({ title: 'Item 23', initialImport: false })
    const detail = (await app.inject({ method: 'GET', url: `/api/rss/items/${items[0].id}` })).json()
    expect(detail.evidence[0]).toMatchObject({ url: 'http://feed.test/23' })
    expect(detail.analysis).toMatchObject({ status: 'pending' })
    for (let index = 0; index < 21; index += 1) await analysisWorker.runOnce()
    const analyzed = (await app.inject({ method: 'GET', url: `/api/rss/items/${items[0].id}` })).json()
    expect(analyzed.analysis).toMatchObject({ status: 'completed', summary: '摘要', model: 'fixture-model' })
    expect(analyzed.evidence[0]).toMatchObject({ url: 'http://feed.test/23' })

    const beforeFailure = await repository.getSource(sourceId)
    status = 500
    const failed = await app.inject({ method: 'POST', url: `/api/rss/sources/${sourceId}/run` })
    expect(failed.statusCode).toBe(502)
    const afterFailure = await repository.getSource(sourceId)
    expect(afterFailure?.etag).toBe(beforeFailure?.etag)
    expect(afterFailure?.etag).toBe('v2')
    await app.close()
  })
})

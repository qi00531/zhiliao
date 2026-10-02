// @vitest-environment node
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createPool } from '../db/pool'
import { migrate } from '../db/migrate'
import { RssRepository } from '../rss/repository'
import { AnalysisRepository } from './repository'

const databaseUrl = process.env.TEST_DATABASE_URL
const describeDatabase = databaseUrl ? describe : describe.skip

describeDatabase('analysis repository', () => {
  const pool = databaseUrl ? createPool(databaseUrl) : null
  const workspaceId = `analysis-${randomUUID()}`
  const rss = pool ? new RssRepository(pool, workspaceId) : null
  const analysis = pool ? new AnalysisRepository(pool, workspaceId) : null
  let itemId = ''

  beforeAll(async () => {
    await migrate(pool!)
    await rss!.transaction(async (client) => {
      const source = await rss!.createSource(client, { url: 'https://example.com/feed', canonicalUrl: 'https://example.com/feed', title: 'Feed', siteUrl: null, etag: null, lastModified: null })
      itemId = (await rss!.insertItem(client, source.id, { externalId: '1', url: 'https://example.com/1', title: 'Item', author: null, summaryText: 'Details', publishedAt: null, contentHash: 'hash' }, false, true))!
    })
  })

  afterAll(async () => {
    await pool!.query('delete from rss_sources where workspace_id=$1', [workspaceId])
    await pool!.end()
  })

  it('creates and atomically claims an analysis job with source content', async () => {
    const job = await analysis!.claimNext()
    expect(job).toMatchObject({ itemId, title: 'Item', sourceSummary: 'Details', attemptCount: 1 })
    expect(await analysis!.claimNext()).toBeNull()
  })

  it('stores a completed result and can requeue it', async () => {
    await analysis!.markCompleted(itemId, { summary: '摘要', relevance: 'high', reason: '相关', model: 'test-model' })
    expect(await analysis!.getForItem(itemId)).toMatchObject({ status: 'completed', summary: '摘要', model: 'test-model' })
    expect(await analysis!.requeue(itemId)).toBe(true)
    expect(await analysis!.getForItem(itemId)).toMatchObject({ status: 'pending' })
  })

  it('records terminal failures safely', async () => {
    await analysis!.claimNext()
    await analysis!.markFailure(itemId, 'AI_AUTH_FAILED', '模型鉴权失败', false)
    expect(await analysis!.getForItem(itemId)).toMatchObject({ status: 'failed', lastErrorCode: 'AI_AUTH_FAILED' })
    expect(await analysis!.claimNext()).toBeNull()
  })
})

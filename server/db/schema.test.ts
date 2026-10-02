// @vitest-environment node
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { PoolClient } from 'pg'
import { createPool } from './pool'
import { migrate } from './migrate'

const databaseUrl = process.env.TEST_DATABASE_URL
const describeDatabase = databaseUrl ? describe : describe.skip

describeDatabase('RSS database schema', () => {
  const pool = databaseUrl ? createPool(databaseUrl) : null
  let client: PoolClient

  beforeAll(async () => {
    client = await pool!.connect()
    await client.query('begin')
    await migrate(client)
  })

  afterAll(async () => {
    await client.query('rollback')
    client.release()
    await pool!.end()
  })

  it('enforces item identity and cascades owned evidence', async () => {
    const sourceId = randomUUID()
    await client.query(
      `insert into rss_sources (id, url, canonical_url, title)
       values ($1, $2, $2, 'Example')`,
      [sourceId, 'https://example.com/feed.xml'],
    )

    const itemId = randomUUID()
    await client.query(
      `insert into rss_items
       (id, source_id, external_id, title, summary_text, current_content_hash)
       values ($1, $2, 'guid:1', 'Entry', '', 'hash')`,
      [itemId, sourceId],
    )

    await client.query('savepoint before_duplicate')
    await expect(client.query(
      `insert into rss_items
       (id, source_id, external_id, title, summary_text, current_content_hash)
       values ($1, $2, 'guid:1', 'Duplicate', '', 'hash-2')`,
      [randomUUID(), sourceId],
    )).rejects.toMatchObject({ code: '23505' })
    await client.query('rollback to savepoint before_duplicate')

    await client.query(
      `insert into rss_evidence (id, item_id, source_id, url, title, excerpt)
       values ($1, $2, $3, 'https://example.com/1', 'Entry', 'Evidence')`,
      [randomUUID(), itemId, sourceId],
    )
    await client.query('delete from rss_sources where id = $1', [sourceId])

    const items = await client.query('select count(*)::int as count from rss_items where source_id=$1', [sourceId])
    const evidence = await client.query('select count(*)::int as count from rss_evidence where source_id=$1', [sourceId])
    expect(items.rows[0].count).toBe(0)
    expect(evidence.rows[0].count).toBe(0)
  })
})

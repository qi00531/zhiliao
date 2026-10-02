import { randomUUID } from 'node:crypto'
import type { Pool, PoolClient } from 'pg'
import type { NormalizedFeedItem } from './types'

type Queryable = Pool | PoolClient

export interface RssSourceRecord {
  id: string
  url: string
  canonicalUrl: string
  title: string
  siteUrl: string | null
  etag: string | null
  lastModified: string | null
  status: 'active' | 'paused' | 'error'
}

export class RssRepository {
  constructor(readonly pool: Pool, readonly workspaceId = 'default') {}

  async transaction<T>(work: (client: PoolClient) => Promise<T>) {
    const client = await this.pool.connect()
    try {
      await client.query('begin')
      const result = await work(client)
      await client.query('commit')
      return result
    } catch (error) {
      await client.query('rollback')
      throw error
    } finally {
      client.release()
    }
  }

  async createSource(target: Queryable, input: Omit<RssSourceRecord, 'id' | 'status'>) {
    const id = randomUUID()
    await target.query(
      `insert into rss_sources
       (id, workspace_id, url, canonical_url, title, site_url, etag, last_modified, next_fetch_at, last_success_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8, now() + interval '1 hour', now())`,
      [id, this.workspaceId, input.url, input.canonicalUrl, input.title, input.siteUrl, input.etag, input.lastModified],
    )
    return { id, ...input, status: 'active' as const }
  }

  async getSource(id: string, target: Queryable = this.pool): Promise<RssSourceRecord | null> {
    const result = await target.query(
      `select id, url, canonical_url, title, site_url, etag, last_modified, status
       from rss_sources where id = $1 and workspace_id = $2`,
      [id, this.workspaceId],
    )
    const row = result.rows[0]
    return row ? {
      id: row.id, url: row.url, canonicalUrl: row.canonical_url, title: row.title,
      siteUrl: row.site_url, etag: row.etag, lastModified: row.last_modified, status: row.status,
    } : null
  }

  async lockSource(id: string, client: PoolClient) {
    const result = await client.query(
      `select id from rss_sources where id = $1 and workspace_id = $2 for update`,
      [id, this.workspaceId],
    )
    if (!result.rowCount) throw new Error('SOURCE_NOT_FOUND')
  }

  async insertItem(target: Queryable, sourceId: string, item: NormalizedFeedItem, initialImport: boolean, visible: boolean) {
    const id = randomUUID()
    const result = await target.query(
      `insert into rss_items
       (id, source_id, external_id, url, title, author, summary_text, published_at, initial_import, visible_on_home, current_content_hash)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       on conflict (source_id, external_id) do nothing returning id`,
      [id, sourceId, item.externalId, item.url, item.title, item.author, item.summaryText, item.publishedAt, initialImport, visible, item.contentHash],
    )
    if (!result.rowCount) return null
    await this.insertRevision(target, id, item)
    await this.insertEvidence(target, id, sourceId, item)
    await target.query('insert into rss_item_analysis (item_id) values ($1) on conflict (item_id) do nothing', [id])
    return id
  }

  async markSeen(target: Queryable, sourceId: string, externalIds: string[]) {
    if (!externalIds.length) return
    await target.query(
      `insert into rss_seen_items (source_id, external_id)
       select $1, unnest($2::text[]) on conflict (source_id, external_id) do nothing`,
      [sourceId, externalIds],
    )
  }

  async hasSeen(target: Queryable, sourceId: string, externalId: string) {
    const result = await target.query(
      'select 1 from rss_seen_items where source_id=$1 and external_id=$2', [sourceId, externalId],
    )
    return Boolean(result.rowCount)
  }

  async findItem(target: Queryable, sourceId: string, externalId: string) {
    const result = await target.query(
      'select id, current_content_hash from rss_items where source_id = $1 and external_id = $2',
      [sourceId, externalId],
    )
    return result.rows[0] as { id: string; current_content_hash: string } | undefined
  }

  async updateItem(target: Queryable, id: string, sourceId: string, item: NormalizedFeedItem) {
    await target.query(
      `update rss_items set url=$2, title=$3, author=$4, summary_text=$5, published_at=$6,
       current_content_hash=$7, visible_on_home=true where id=$1`,
      [id, item.url, item.title, item.author, item.summaryText, item.publishedAt, item.contentHash],
    )
    await this.insertRevision(target, id, item)
    await this.insertEvidence(target, id, sourceId, item)
    await target.query(`insert into rss_item_analysis (item_id, status, attempt_count, next_attempt_at, updated_at)
      values ($1, 'pending', 0, now(), now()) on conflict (item_id) do update set
      status='pending', attempt_count=0, next_attempt_at=now(), last_error_code=null, last_error_message=null, updated_at=now()`, [id])
  }

  private async insertRevision(target: Queryable, itemId: string, item: NormalizedFeedItem) {
    await target.query(
      `insert into rss_item_revisions (item_id, content_hash, title, summary_text)
       values ($1,$2,$3,$4) on conflict (item_id, content_hash) do nothing`,
      [itemId, item.contentHash, item.title, item.summaryText],
    )
  }

  private async insertEvidence(target: Queryable, itemId: string, sourceId: string, item: NormalizedFeedItem) {
    if (!item.url) return
    await target.query(
      `insert into rss_evidence (item_id, source_id, url, title, excerpt)
       values ($1,$2,$3,$4,$5) on conflict (item_id, url) do update set title=excluded.title, excerpt=excluded.excerpt, captured_at=now()`,
      [itemId, sourceId, item.url, item.title, item.summaryText.slice(0, 1_000)],
    )
  }

  async markSuccess(target: Queryable, sourceId: string, etag: string | null, lastModified: string | null, itemCount: number) {
    await target.query(
      `update rss_sources set status='active', etag=$2, last_modified=$3, last_success_at=now(),
       last_error_code=null, last_error_message=null, next_fetch_at=now()+interval '1 hour', updated_at=now()
       where id=$1`,
      [sourceId, etag, lastModified],
    )
    await target.query(
      `insert into rss_fetch_runs (source_id, finished_at, outcome, http_status, item_count)
       values ($1, now(), 'success', 200, $2)`, [sourceId, itemCount],
    )
  }

  async markNotModified(sourceId: string) {
    await this.pool.query(
      `update rss_sources set status='active', last_success_at=now(), next_fetch_at=now()+interval '1 hour',
       last_error_code=null, last_error_message=null, updated_at=now() where id=$1 and workspace_id=$2`,
      [sourceId, this.workspaceId],
    )
    await this.pool.query(
      `insert into rss_fetch_runs (source_id, finished_at, outcome, http_status) values ($1,now(),'not_modified',304)`,
      [sourceId],
    )
  }

  async markFailure(sourceId: string, code: string, message: string) {
    await this.pool.query(
      `update rss_sources set status='error', last_error_code=$3, last_error_message=$4,
       next_fetch_at=now()+interval '15 minutes', updated_at=now() where id=$1 and workspace_id=$2`,
      [sourceId, this.workspaceId, code, message],
    )
    await this.pool.query(
      `insert into rss_fetch_runs (source_id, finished_at, outcome, error_code, error_message)
       values ($1,now(),'failed',$2,$3)`, [sourceId, code, message],
    )
  }

  async countItems(sourceId: string) {
    const result = await this.pool.query('select count(*)::int count from rss_items where source_id=$1', [sourceId])
    return result.rows[0].count as number
  }

  async countRevisions(sourceId: string) {
    const result = await this.pool.query(
      `select count(*)::int count from rss_item_revisions r join rss_items i on i.id=r.item_id where i.source_id=$1`, [sourceId],
    )
    return result.rows[0].count as number
  }

  async listVisibleItems({ sourceId }: { sourceId?: string } = {}) {
    const values: unknown[] = [this.workspaceId]
    const sourceFilter = sourceId ? 'and i.source_id=$2' : ''
    if (sourceId) values.push(sourceId)
    const result = await this.pool.query(
      `select i.id, i.source_id, i.title, i.url, i.summary_text, i.published_at, i.first_seen_at,
       i.initial_import, s.title source_title
       from rss_items i join rss_sources s on s.id=i.source_id
       where s.workspace_id=$1 and i.visible_on_home ${sourceFilter}
       order by coalesce(i.published_at,i.first_seen_at) desc`, values,
    )
    return result.rows.map((row) => ({
      id: row.id, sourceId: row.source_id, sourceTitle: row.source_title, title: row.title,
      url: row.url, summaryText: row.summary_text, publishedAt: row.published_at,
      firstSeenAt: row.first_seen_at, initialImport: row.initial_import,
    }))
  }

  async listSources() {
    const result = await this.pool.query(
      `select id, title, url, site_url, status, frequency, last_success_at, next_fetch_at,
       last_error_code, last_error_message, etag, last_modified
       from rss_sources where workspace_id=$1 order by created_at desc`, [this.workspaceId],
    )
    return result.rows.map((row) => ({
      id: row.id, title: row.title, url: row.url, siteUrl: row.site_url, status: row.status,
      frequency: row.frequency, lastSuccessAt: row.last_success_at, nextFetchAt: row.next_fetch_at,
      lastErrorCode: row.last_error_code, lastErrorMessage: row.last_error_message,
      etag: row.etag, lastModified: row.last_modified,
    }))
  }

  async getItemWithEvidence(id: string) {
    const item = await this.pool.query(
      `select i.id, i.title, i.url, i.summary_text, i.published_at, i.first_seen_at, i.initial_import,
       s.id source_id, s.title source_title, a.status analysis_status, a.summary analysis_summary,
       a.relevance analysis_relevance, a.reason analysis_reason, a.model analysis_model,
       a.last_error_code analysis_error_code, a.last_error_message analysis_error_message, a.completed_at analysis_completed_at
       from rss_items i join rss_sources s on s.id=i.source_id
       left join rss_item_analysis a on a.item_id=i.id
       where i.id=$1 and s.workspace_id=$2`, [id, this.workspaceId],
    )
    if (!item.rowCount) return null
    const evidence = await this.pool.query(
      `select id, url, title, excerpt, captured_at from rss_evidence where item_id=$1 order by captured_at desc`, [id],
    )
    const row = item.rows[0]
    return {
      id: row.id, title: row.title, url: row.url, summaryText: row.summary_text,
      publishedAt: row.published_at, firstSeenAt: row.first_seen_at, initialImport: row.initial_import,
      sourceId: row.source_id, sourceTitle: row.source_title,
      analysis: row.analysis_status ? {
        status: row.analysis_status, summary: row.analysis_summary, relevance: row.analysis_relevance,
        reason: row.analysis_reason, model: row.analysis_model, lastErrorCode: row.analysis_error_code,
        lastErrorMessage: row.analysis_error_message, completedAt: row.analysis_completed_at,
      } : null,
      evidence: evidence.rows.map((entry) => ({
        id: entry.id, url: entry.url, title: entry.title, excerpt: entry.excerpt, capturedAt: entry.captured_at,
      })),
    }
  }

  async updateSourceSettings(id: string, input: { status?: 'active' | 'paused'; frequency?: 'adaptive' | 'immediate' | 'daily' | 'weekly' | 'manual' }) {
    const result = await this.pool.query(
      `update rss_sources set status=coalesce($3,status), frequency=coalesce($4,frequency),
       next_fetch_at=case when $3='active' then now() else next_fetch_at end, updated_at=now()
       where id=$1 and workspace_id=$2 returning id, title, status, frequency`,
      [id, this.workspaceId, input.status ?? null, input.frequency ?? null],
    )
    return result.rows[0] ?? null
  }

  async claimDueSources(limit: number) {
    return this.transaction(async (client) => {
      const result = await client.query(
        `select id from rss_sources where workspace_id=$1 and status in ('active','error')
         and frequency <> 'manual' and next_fetch_at <= now()
         order by next_fetch_at asc for update skip locked limit $2`, [this.workspaceId, limit],
      )
      const ids = result.rows.map((row) => row.id as string)
      if (ids.length) {
        await client.query(`update rss_sources set next_fetch_at=now()+interval '5 minutes' where id=any($1::uuid[])`, [ids])
      }
      return ids
    })
  }

  async checkHealth() {
    await this.pool.query('select 1')
    return true
  }
}

import type { Pool } from 'pg'
import type { AnalysisResult, Relevance } from './types'

export interface AnalysisJob {
  itemId: string
  title: string
  sourceSummary: string
  attemptCount: number
}

export class AnalysisRepository {
  constructor(private readonly pool: Pool, private readonly workspaceId = 'default') {}

  async claimNext(): Promise<AnalysisJob | null> {
    const client = await this.pool.connect()
    try {
      await client.query('begin')
      const result = await client.query(
        `select a.item_id, i.title, i.summary_text, a.attempt_count
         from rss_item_analysis a
         join rss_items i on i.id=a.item_id
         join rss_sources s on s.id=i.source_id
         where s.workspace_id=$1 and a.status in ('pending','failed') and a.next_attempt_at <= now()
         order by a.next_attempt_at, a.created_at for update of a skip locked limit 1`, [this.workspaceId],
      )
      const row = result.rows[0]
      if (!row) { await client.query('commit'); return null }
      const updated = await client.query(
        `update rss_item_analysis set status='processing', attempt_count=attempt_count+1, updated_at=now()
         where item_id=$1 returning attempt_count`, [row.item_id],
      )
      await client.query('commit')
      return { itemId: row.item_id, title: row.title, sourceSummary: row.summary_text, attemptCount: updated.rows[0].attempt_count }
    } catch (error) {
      await client.query('rollback')
      throw error
    } finally { client.release() }
  }

  async markCompleted(itemId: string, result: AnalysisResult) {
    await this.pool.query(
      `update rss_item_analysis set status='completed', summary=$2, relevance=$3, reason=$4, model=$5,
       last_error_code=null, last_error_message=null, completed_at=now(), updated_at=now() where item_id=$1`,
      [itemId, result.summary, result.relevance, result.reason, result.model],
    )
  }

  async markFailure(itemId: string, code: string, message: string, retryable: boolean) {
    await this.pool.query(
      `update rss_item_analysis set status='failed', last_error_code=$2, last_error_message=$3,
       next_attempt_at=case when $4 and attempt_count < 3 then now() + (attempt_count * interval '30 seconds') else 'infinity'::timestamptz end,
       updated_at=now() where item_id=$1`, [itemId, code, message, retryable],
    )
  }

  async markNotConfigured(itemId: string) {
    await this.pool.query(
      `update rss_item_analysis set status='not_configured', last_error_code='AI_NOT_CONFIGURED',
       last_error_message='尚未配置 AI', updated_at=now() where item_id=$1`, [itemId],
    )
  }

  async requeue(itemId: string) {
    const result = await this.pool.query(
      `update rss_item_analysis a set status='pending', attempt_count=0, next_attempt_at=now(),
       last_error_code=null, last_error_message=null, updated_at=now()
       from rss_items i join rss_sources s on s.id=i.source_id
       where a.item_id=$1 and i.id=a.item_id and s.workspace_id=$2 returning a.item_id`, [itemId, this.workspaceId],
    )
    return Boolean(result.rowCount)
  }

  async getForItem(itemId: string) {
    const result = await this.pool.query(
      `select a.status, a.summary, a.relevance, a.reason, a.model, a.attempt_count,
       a.last_error_code, a.last_error_message, a.completed_at
       from rss_item_analysis a join rss_items i on i.id=a.item_id join rss_sources s on s.id=i.source_id
       where a.item_id=$1 and s.workspace_id=$2`, [itemId, this.workspaceId],
    )
    const row = result.rows[0]
    return row ? {
      status: row.status as string, summary: row.summary as string | null,
      relevance: row.relevance as Relevance | null, reason: row.reason as string | null,
      model: row.model as string | null, attemptCount: row.attempt_count as number,
      lastErrorCode: row.last_error_code as string | null, lastErrorMessage: row.last_error_message as string | null,
      completedAt: row.completed_at as Date | null,
    } : null
  }
}

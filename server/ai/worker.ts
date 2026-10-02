import { AiAnalysisError, type ContentAnalyzer } from './types'
import type { AnalysisJob } from './repository'

interface WorkerRepository {
  claimNext(): Promise<AnalysisJob | null>
  markCompleted(itemId: string, result: Awaited<ReturnType<ContentAnalyzer['analyze']>>): Promise<void>
  markFailure(itemId: string, code: string, message: string, retryable: boolean): Promise<void>
  markNotConfigured(itemId: string): Promise<void>
}

export function createAnalysisWorker({ repository, analyzer, intervalMs }: {
  repository: WorkerRepository
  analyzer: ContentAnalyzer | null
  intervalMs: number
}) {
  let timer: ReturnType<typeof setInterval> | null = null
  let running = false

  async function runOnce() {
    if (running) return
    running = true
    try {
      const job = await repository.claimNext()
      if (!job) return
      if (!analyzer) {
        await repository.markNotConfigured(job.itemId)
        return
      }
      try {
        const result = await analyzer.analyze({ title: job.title, sourceSummary: job.sourceSummary })
        await repository.markCompleted(job.itemId, result)
      } catch (error) {
        const known = error instanceof AiAnalysisError
          ? error
          : new AiAnalysisError('AI_UPSTREAM_FAILED', true, '模型服务暂时不可用')
        await repository.markFailure(job.itemId, known.code, known.message, known.retryable)
      }
    } finally { running = false }
  }

  function start() {
    if (timer) return
    timer = setInterval(() => { void runOnce() }, intervalMs)
    timer.unref()
    void runOnce()
  }

  function stop() {
    if (timer) clearInterval(timer)
    timer = null
  }

  return { runOnce, start, stop }
}

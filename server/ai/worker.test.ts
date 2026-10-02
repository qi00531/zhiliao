// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { AiAnalysisError } from './types'
import { createAnalysisWorker } from './worker'

const job = { itemId: 'item-1', title: 'Title', sourceSummary: 'Details', attemptCount: 1 }

describe('analysis worker', () => {
  it('completes a claimed job', async () => {
    const repository = {
      claimNext: vi.fn(async () => job), markCompleted: vi.fn(async () => undefined),
      markFailure: vi.fn(async () => undefined), markNotConfigured: vi.fn(async () => undefined),
    }
    const analyzer = { analyze: vi.fn(async () => ({ summary: '摘要', relevance: 'high' as const, reason: '相关', model: 'model' })) }
    const worker = createAnalysisWorker({ repository, analyzer, intervalMs: 1000 })
    await worker.runOnce()
    expect(repository.markCompleted).toHaveBeenCalledWith('item-1', expect.objectContaining({ summary: '摘要' }))
  })

  it('persists safe analyzer failures', async () => {
    const repository = {
      claimNext: vi.fn(async () => job), markCompleted: vi.fn(async () => undefined),
      markFailure: vi.fn(async () => undefined), markNotConfigured: vi.fn(async () => undefined),
    }
    const analyzer = { analyze: vi.fn(async () => { throw new AiAnalysisError('AI_RATE_LIMITED', true, '模型请求受限') }) }
    await createAnalysisWorker({ repository, analyzer, intervalMs: 1000 }).runOnce()
    expect(repository.markFailure).toHaveBeenCalledWith('item-1', 'AI_RATE_LIMITED', '模型请求受限', true)
  })

  it('marks a claimed job when AI is not configured', async () => {
    const repository = {
      claimNext: vi.fn(async () => job), markCompleted: vi.fn(async () => undefined),
      markFailure: vi.fn(async () => undefined), markNotConfigured: vi.fn(async () => undefined),
    }
    await createAnalysisWorker({ repository, analyzer: null, intervalMs: 1000 }).runOnce()
    expect(repository.markNotConfigured).toHaveBeenCalledWith('item-1')
  })
})

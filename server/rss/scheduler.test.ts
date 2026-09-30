// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { createRssScheduler } from './scheduler'

describe('RSS scheduler', () => {
  it('claims at most five due sources and respects concurrency two', async () => {
    const repository = { claimDueSources: vi.fn(async () => ['1', '2', '3', '4', '5']) }
    let active = 0
    let peak = 0
    const refreshSource = vi.fn(async () => {
      active += 1
      peak = Math.max(peak, active)
      await new Promise((resolve) => setTimeout(resolve, 5))
      active -= 1
    })
    const scheduler = createRssScheduler({ repository, refreshSource, intervalMs: 30_000, concurrency: 2 })
    await scheduler.runOnce()
    expect(repository.claimDueSources).toHaveBeenCalledWith(5)
    expect(refreshSource).toHaveBeenCalledTimes(5)
    expect(peak).toBe(2)
  })
})

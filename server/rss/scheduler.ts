interface SchedulerRepository { claimDueSources(limit: number): Promise<string[]> }

export function createRssScheduler({ repository, refreshSource, intervalMs, concurrency }: {
  repository: SchedulerRepository
  refreshSource(id: string): Promise<unknown>
  intervalMs: number
  concurrency: number
}) {
  let timer: ReturnType<typeof setInterval> | null = null
  let running = false

  async function runOnce() {
    if (running) return
    running = true
    try {
      const queue = await repository.claimDueSources(5)
      const workers = Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
        while (queue.length) {
          const id = queue.shift()
          if (!id) return
          try { await refreshSource(id) } catch { /* failure is persisted by ingestion */ }
        }
      })
      await Promise.all(workers)
    } finally {
      running = false
    }
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

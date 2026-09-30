import { join } from 'node:path'
import Fastify from 'fastify'
import fastifyStatic from '@fastify/static'
import { registerRssRoutes, type RssRouteDependencies } from './routes/rss'
import { createRssScheduler } from './rss/scheduler'

interface AppDependencies extends RssRouteDependencies {
  repository: RssRouteDependencies['repository'] & {
    claimDueSources?(limit: number): Promise<string[]>
    checkHealth(): Promise<boolean>
  }
  startWorker?: boolean
}

export function buildApp(deps: AppDependencies) {
  const app = Fastify({ logger: process.env.NODE_ENV !== 'test' })
  void registerRssRoutes(app, deps)

  const scheduler = deps.repository.claimDueSources ? createRssScheduler({
    repository: { claimDueSources: deps.repository.claimDueSources.bind(deps.repository) },
    refreshSource: deps.service.refreshSource.bind(deps.service),
    intervalMs: 30_000,
    concurrency: 2,
  }) : null

  if (deps.startWorker !== false && scheduler) {
    app.addHook('onReady', async () => { scheduler.start() })
    app.addHook('onClose', async () => { scheduler.stop() })
  }

  app.get('/health', async (_request, reply) => {
    try {
      await deps.repository.checkHealth()
      return { status: 'ok', worker: scheduler ? 'ready' : 'disabled' }
    } catch {
      return reply.status(503).send({ status: 'unavailable' })
    }
  })

  if (process.env.NODE_ENV === 'production') {
    void app.register(fastifyStatic, { root: join(process.cwd(), 'dist') })
  }

  app.setErrorHandler((error, _request, reply) => {
    const knownError = error instanceof Error ? error : new Error('服务暂时不可用')
    const candidateCode = (error as { code?: unknown }).code
    const code = typeof candidateCode === 'string' ? candidateCode : 'INTERNAL_ERROR'
    const status = code === 'SOURCE_NOT_FOUND' ? 404 : code === '23505' ? 409 : 502
    const publicCode = code === '23505' ? 'SOURCE_EXISTS' : code
    void reply.status(status).send({ error: { code: publicCode, message: knownError.message } })
  })

  return app
}

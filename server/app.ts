import { join } from 'node:path'
import Fastify from 'fastify'
import fastifyStatic from '@fastify/static'
import { registerAiRoutes, type AiRouteDependencies } from './routes/ai'
import { registerRssRoutes, type RssRouteDependencies } from './routes/rss'
import { createRssScheduler } from './rss/scheduler'

interface Lifecycle { start(): void; stop(): void }
interface AppDependencies extends RssRouteDependencies {
  repository: RssRouteDependencies['repository'] & {
    claimDueSources?(limit: number): Promise<string[]>
    checkHealth(): Promise<boolean>
  }
  ai?: AiRouteDependencies
  analysisWorker?: Lifecycle
  startWorker?: boolean
}

export function buildApp(deps: AppDependencies) {
  const app = Fastify({ logger: process.env.NODE_ENV !== 'test' })
  void registerRssRoutes(app, deps)
  if (deps.ai) void registerAiRoutes(app, deps.ai)

  const scheduler = deps.repository.claimDueSources ? createRssScheduler({
    repository: { claimDueSources: deps.repository.claimDueSources.bind(deps.repository) },
    refreshSource: deps.service.refreshSource.bind(deps.service),
    intervalMs: 30_000,
    concurrency: 2,
  }) : null

  if (deps.startWorker !== false) {
    app.addHook('onReady', async () => { scheduler?.start(); deps.analysisWorker?.start() })
    app.addHook('onClose', async () => { scheduler?.stop(); deps.analysisWorker?.stop() })
  }

  app.get('/health', async (_request, reply) => {
    try {
      await deps.repository.checkHealth()
      return {
        status: 'ok',
        worker: scheduler ? 'ready' : 'disabled',
        ai: deps.ai?.configured ? 'ready' : 'not_configured',
      }
    } catch {
      return reply.status(503).send({ status: 'unavailable', ai: deps.ai?.configured ? 'ready' : 'not_configured' })
    }
  })

  if (process.env.NODE_ENV === 'production') void app.register(fastifyStatic, { root: join(process.cwd(), 'dist') })

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

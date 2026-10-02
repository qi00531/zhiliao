import { buildApp } from './app'
import { createOpenAiCompatibleAnalyzer } from './ai/openai-compatible'
import { AnalysisRepository } from './ai/repository'
import { createAnalysisWorker } from './ai/worker'
import { readConfig } from './config'
import { migrate } from './db/migrate'
import { createPool } from './db/pool'
import { createFeedFetcher } from './rss/fetch-feed'
import { createRssIngestionService } from './rss/ingest'
import { RssRepository } from './rss/repository'

const config = readConfig(process.env)
const pool = createPool(config.databaseUrl)
await migrate(pool)
const repository = new RssRepository(pool)
const analysisRepository = new AnalysisRepository(pool)
const analyzer = config.ai ? createOpenAiCompatibleAnalyzer(config.ai) : null
const analysisWorker = createAnalysisWorker({ repository: analysisRepository, analyzer, intervalMs: 5_000 })
const fetchFeed = createFeedFetcher({ timeoutMs: config.fetchTimeoutMs, maxBytes: config.maxFeedBytes })
const service = createRssIngestionService({ repository, fetchFeed })
const app = buildApp({
  repository,
  service,
  analysisWorker,
  ai: {
    configured: Boolean(config.ai),
    model: config.ai?.model ?? null,
    requeue: analysisRepository.requeue.bind(analysisRepository),
  },
})

app.addHook('onClose', async () => { await pool.end() })
await app.listen({ host: config.host, port: config.port })

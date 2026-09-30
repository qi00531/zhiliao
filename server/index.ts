import { buildApp } from './app'
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
const fetchFeed = createFeedFetcher({ timeoutMs: config.fetchTimeoutMs, maxBytes: config.maxFeedBytes })
const service = createRssIngestionService({ repository, fetchFeed })
const app = buildApp({ repository, service })

app.addHook('onClose', async () => { await pool.end() })
await app.listen({ host: config.host, port: config.port })

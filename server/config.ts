import { z } from 'zod'

const configSchema = z.object({
  DATABASE_URL: z.string().min(1),
  HOST: z.string().default('127.0.0.1'),
  PORT: z.coerce.number().int().positive().default(8787),
  WEB_ORIGIN: z.string().url().default('http://127.0.0.1:5173'),
  RSS_FETCH_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),
  RSS_MAX_BYTES: z.coerce.number().int().positive().max(10_485_760).default(2_097_152),
})

export function readConfig(env: NodeJS.ProcessEnv) {
  const value = configSchema.parse(env)

  return {
    databaseUrl: value.DATABASE_URL,
    host: value.HOST,
    port: value.PORT,
    webOrigin: value.WEB_ORIGIN,
    fetchTimeoutMs: value.RSS_FETCH_TIMEOUT_MS,
    maxFeedBytes: value.RSS_MAX_BYTES,
  }
}

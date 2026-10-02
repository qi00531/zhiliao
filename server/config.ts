import { z } from 'zod'

const configSchema = z.object({
  DATABASE_URL: z.string().min(1),
  HOST: z.string().default('127.0.0.1'),
  PORT: z.coerce.number().int().positive().default(8787),
  WEB_ORIGIN: z.string().url().default('http://127.0.0.1:5173'),
  RSS_FETCH_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),
  RSS_MAX_BYTES: z.coerce.number().int().positive().max(10_485_760).default(2_097_152),
  AI_BASE_URL: z.string().url().optional(),
  AI_API_KEY: z.string().min(1).optional(),
  AI_MODEL: z.string().min(1).optional(),
  AI_TIMEOUT_MS: z.coerce.number().int().positive().default(30_000),
}).superRefine((value, context) => {
  const configured = [value.AI_BASE_URL, value.AI_API_KEY, value.AI_MODEL].filter(Boolean).length
  if (configured > 0 && configured < 3) context.addIssue({
    code: 'custom',
    message: 'AI_BASE_URL, AI_API_KEY and AI_MODEL must be configured together',
  })
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
    ai: value.AI_BASE_URL && value.AI_API_KEY && value.AI_MODEL ? {
      baseUrl: value.AI_BASE_URL,
      apiKey: value.AI_API_KEY,
      model: value.AI_MODEL,
      timeoutMs: value.AI_TIMEOUT_MS,
    } : null,
  }
}

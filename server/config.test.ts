import { describe, expect, it } from 'vitest'
import { readConfig } from './config'

describe('readConfig', () => {
  it('rejects a missing database URL', () => {
    expect(() => readConfig({})).toThrow('DATABASE_URL')
  })

  it('binds to loopback and applies bounded RSS defaults', () => {
    expect(readConfig({ DATABASE_URL: 'postgres://local/test' })).toEqual({
      databaseUrl: 'postgres://local/test',
      host: '127.0.0.1',
      port: 8787,
      webOrigin: 'http://127.0.0.1:5173',
      fetchTimeoutMs: 10_000,
      maxFeedBytes: 2_097_152,
    })
  })
})

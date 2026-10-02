// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { databaseEndpoint, parseEnvFile } from './dev-setup'

describe('dev setup helpers', () => {
  it('reuses an already reachable database', async () => {
    const module = await import('./dev-setup')
    expect(module.shouldStartDatabase(true)).toBe(false)
    expect(module.shouldStartDatabase(false)).toBe(true)
  })

  it('parses a local env file without changing existing environment values', () => {
    expect(parseEnvFile('DATABASE_URL=postgres://local/db\nAI_MODEL=test-model\n# comment\n', { AI_MODEL: 'override' })).toMatchObject({
      DATABASE_URL: 'postgres://local/db', AI_MODEL: 'override',
    })
  })

  it('derives the database host and port', () => {
    expect(databaseEndpoint('postgresql://postgres:postgres@127.0.0.1:5433/zhiliao')).toEqual({ host: '127.0.0.1', port: 5433 })
  })
})

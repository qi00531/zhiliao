// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { buildApp } from '../app'

function base() {
  return {
    service: { connectFeed: vi.fn(), refreshSource: vi.fn() },
    repository: {
      listSources: vi.fn(async () => []), listVisibleItems: vi.fn(async () => []),
      getItemWithEvidence: vi.fn(async () => null), updateSourceSettings: vi.fn(),
      checkHealth: vi.fn(async () => true),
    },
  }
}

describe('AI status routes', () => {
  it('reports not configured without exposing secrets', async () => {
    const app = buildApp({ ...base(), ai: { configured: false, model: null, requeue: vi.fn() }, startWorker: false })
    expect((await app.inject({ method: 'GET', url: '/api/ai/status' })).json()).toEqual({ status: 'not_configured', model: null })
    expect((await app.inject({ method: 'GET', url: '/health' })).json()).toMatchObject({ status: 'ok', ai: 'not_configured' })
    const response = await app.inject({ method: 'POST', url: '/api/rss/items/item-1/analyze' })
    expect(response.statusCode).toBe(503)
    expect(response.json()).toMatchObject({ error: { code: 'AI_NOT_CONFIGURED' } })
    await app.close()
  })

  it('requeues a known item when configured', async () => {
    const requeue = vi.fn(async () => true)
    const app = buildApp({ ...base(), ai: { configured: true, model: 'test-model', requeue }, startWorker: false })
    expect((await app.inject({ method: 'GET', url: '/api/ai/status' })).json()).toEqual({ status: 'ready', model: 'test-model' })
    expect((await app.inject({ method: 'POST', url: '/api/rss/items/item-1/analyze' })).statusCode).toBe(202)
    expect(requeue).toHaveBeenCalledWith('item-1')
    await app.close()
  })

  it('returns 404 when the item does not exist', async () => {
    const app = buildApp({ ...base(), ai: { configured: true, model: 'test-model', requeue: vi.fn(async () => false) }, startWorker: false })
    expect((await app.inject({ method: 'POST', url: '/api/rss/items/missing/analyze' })).statusCode).toBe(404)
    await app.close()
  })
})

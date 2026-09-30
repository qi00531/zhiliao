// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { buildApp } from '../app'

function dependencies() {
  return {
    service: {
      connectFeed: vi.fn(async () => ({ id: 'source-1', title: 'Example' })),
      refreshSource: vi.fn(async () => ({ added: 1, revised: 0 })),
    },
    repository: {
      listSources: vi.fn(async () => [{ id: 'source-1', title: 'Example', status: 'active' }]),
      listVisibleItems: vi.fn(async () => [{ id: 'item-1', title: 'Update', initialImport: false }]),
      getItemWithEvidence: vi.fn(async () => ({ id: 'item-1', title: 'Update', evidence: [] })),
      updateSourceSettings: vi.fn(async () => ({ id: 'source-1', status: 'paused' })),
      checkHealth: vi.fn(async () => true),
    },
  }
}

describe('RSS routes', () => {
  it('connects a source and returns the three visible baseline items', async () => {
    const deps = dependencies()
    deps.repository.listVisibleItems.mockResolvedValueOnce([
      { id: '1', title: 'One', initialImport: true },
      { id: '2', title: 'Two', initialImport: true },
      { id: '3', title: 'Three', initialImport: true },
    ])
    const app = buildApp({ ...deps, startWorker: false })
    const response = await app.inject({ method: 'POST', url: '/api/rss/sources', payload: {
      url: 'https://example.com/feed.xml', initialMode: 'latest-20',
    } })
    expect(response.statusCode).toBe(201)
    expect(response.json().initialItems).toHaveLength(3)
    await app.close()
  })

  it('validates input and returns a stable error code', async () => {
    const app = buildApp({ ...dependencies(), startWorker: false })
    const response = await app.inject({ method: 'POST', url: '/api/rss/sources', payload: { url: 'nope' } })
    expect(response.statusCode).toBe(400)
    expect(response.json()).toMatchObject({ error: { code: 'INVALID_REQUEST' } })
    await app.close()
  })

  it('lists sources and item evidence', async () => {
    const app = buildApp({ ...dependencies(), startWorker: false })
    expect((await app.inject({ method: 'GET', url: '/api/rss/sources' })).statusCode).toBe(200)
    expect((await app.inject({ method: 'GET', url: '/api/rss/items/item-1' })).json()).toMatchObject({ id: 'item-1' })
    await app.close()
  })

  it('updates settings and requests a manual run', async () => {
    const deps = dependencies()
    const app = buildApp({ ...deps, startWorker: false })
    expect((await app.inject({ method: 'PATCH', url: '/api/rss/sources/source-1', payload: { status: 'paused' } })).statusCode).toBe(200)
    expect((await app.inject({ method: 'POST', url: '/api/rss/sources/source-1/run' })).statusCode).toBe(202)
    expect(deps.service.refreshSource).toHaveBeenCalledWith('source-1')
    await app.close()
  })
})

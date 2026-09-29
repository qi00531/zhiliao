// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { createFeedFetcher } from './fetch-feed'

const publicPolicy = { assertPublicHttpUrl: vi.fn(async (url: string) => url) }

describe('fetchFeed', () => {
  it('sends conditional headers and returns a bounded response', async () => {
    const request = vi.fn(async (_url: string, init?: RequestInit) => {
      expect(new Headers(init?.headers).get('if-none-match')).toBe('v1')
      return new Response('<rss/>', { status: 200, headers: { etag: 'v2', 'content-type': 'application/rss+xml' } })
    })
    const fetchFeed = createFeedFetcher({ request, urlPolicy: publicPolicy, timeoutMs: 1000, maxBytes: 100 })
    await expect(fetchFeed('https://public.test/feed', { etag: 'v1' })).resolves.toMatchObject({
      kind: 'fetched', etag: 'v2', body: '<rss/>',
    })
  })

  it('returns not-modified without a body', async () => {
    const fetchFeed = createFeedFetcher({ request: vi.fn(async () => new Response(null, { status: 304 })), urlPolicy: publicPolicy, timeoutMs: 1000, maxBytes: 100 })
    await expect(fetchFeed('https://public.test/feed', {})).resolves.toEqual({ kind: 'not-modified', status: 304 })
  })

  it('rejects an oversized streamed body', async () => {
    const fetchFeed = createFeedFetcher({ request: vi.fn(async () => new Response('x'.repeat(101))), urlPolicy: publicPolicy, timeoutMs: 1000, maxBytes: 100 })
    await expect(fetchFeed('https://public.test/feed', {})).rejects.toMatchObject({ code: 'FEED_TOO_LARGE' })
  })

  it('validates every redirect target', async () => {
    const request = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: 'http://private.test/feed' } }))
    const urlPolicy = { assertPublicHttpUrl: vi.fn(async (url: string) => {
      if (url.includes('private.test')) throw Object.assign(new Error('private'), { code: 'PRIVATE_NETWORK_URL' })
      return url
    }) }
    const fetchFeed = createFeedFetcher({ request, urlPolicy, timeoutMs: 1000, maxBytes: 100 })
    await expect(fetchFeed('https://public.test/feed', {})).rejects.toMatchObject({ code: 'PRIVATE_NETWORK_URL' })
    expect(urlPolicy.assertPublicHttpUrl).toHaveBeenCalledTimes(2)
  })
})

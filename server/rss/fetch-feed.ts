import { assertPublicHttpUrl } from './url-policy'

type UrlPolicy = { assertPublicHttpUrl(url: string): Promise<string> }
type FetchRequest = (input: string, init?: RequestInit) => Promise<Response>

export class FeedFetchError extends Error {
  constructor(public readonly code: 'FETCH_FAILED' | 'FETCH_TIMEOUT' | 'FEED_TOO_LARGE' | 'TOO_MANY_REDIRECTS', message: string) {
    super(message)
    this.name = 'FeedFetchError'
  }
}

interface FetcherOptions {
  request?: FetchRequest
  urlPolicy?: UrlPolicy
  timeoutMs: number
  maxBytes: number
}

interface ConditionalHeaders { etag?: string | null; lastModified?: string | null }

async function readBounded(response: Response, maxBytes: number) {
  const declared = Number(response.headers.get('content-length'))
  if (Number.isFinite(declared) && declared > maxBytes) throw new FeedFetchError('FEED_TOO_LARGE', 'Feed 内容过大')
  if (!response.body) return ''
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > maxBytes) {
      await reader.cancel()
      throw new FeedFetchError('FEED_TOO_LARGE', 'Feed 内容过大')
    }
    chunks.push(value)
  }
  const body = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength }
  return new TextDecoder().decode(body)
}

export function createFeedFetcher(options: FetcherOptions) {
  const request = options.request ?? fetch
  const urlPolicy = options.urlPolicy ?? { assertPublicHttpUrl }

  return async function fetchFeed(input: string, conditional: ConditionalHeaders) {
    let url = await urlPolicy.assertPublicHttpUrl(input)
    for (let redirects = 0; redirects <= 5; redirects += 1) {
      let response: Response
      try {
        response = await request(url, {
          redirect: 'manual',
          signal: AbortSignal.timeout(options.timeoutMs),
          headers: {
            accept: 'application/rss+xml, application/atom+xml, application/feed+json, application/json;q=0.9, application/xml;q=0.8, text/xml;q=0.8',
            ...(conditional.etag ? { 'if-none-match': conditional.etag } : {}),
            ...(conditional.lastModified ? { 'if-modified-since': conditional.lastModified } : {}),
          },
        })
      } catch (error) {
        if (error instanceof DOMException && error.name === 'TimeoutError') throw new FeedFetchError('FETCH_TIMEOUT', '抓取超时')
        throw new FeedFetchError('FETCH_FAILED', '无法获取 Feed')
      }
      if (response.status === 304) return { kind: 'not-modified' as const, status: 304 }
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location')
        if (!location) throw new FeedFetchError('FETCH_FAILED', 'Feed 重定向无效')
        if (redirects === 5) throw new FeedFetchError('TOO_MANY_REDIRECTS', 'Feed 重定向次数过多')
        url = await urlPolicy.assertPublicHttpUrl(new URL(location, url).toString())
        continue
      }
      if (!response.ok) throw new FeedFetchError('FETCH_FAILED', `Feed 返回 ${response.status}`)
      return {
        kind: 'fetched' as const,
        status: response.status,
        url,
        body: await readBounded(response, options.maxBytes),
        contentType: response.headers.get('content-type') ?? '',
        etag: response.headers.get('etag'),
        lastModified: response.headers.get('last-modified'),
      }
    }
    throw new FeedFetchError('TOO_MANY_REDIRECTS', 'Feed 重定向次数过多')
  }
}

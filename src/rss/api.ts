import { RssApiError, type ConnectRssResponse, type RssInitialMode, type RssItemDetailDto, type RssItemDto, type RssSourceDto } from './types'

type Fetcher = typeof fetch

async function readResponse<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => ({})) as { error?: { code?: string; message?: string } }
  if (!response.ok) {
    throw new RssApiError(body.error?.code ?? 'REQUEST_FAILED', body.error?.message ?? '暂时无法完成')
  }
  return body as T
}

export function createRssApi(request?: Fetcher) {
  const send: Fetcher = (...args) => (request ?? fetch)(...args)
  return {
    async connect(url: string, initialMode: RssInitialMode) {
      const response = await send('/api/rss/sources', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url, initialMode }),
      })
      return readResponse<ConnectRssResponse>(response)
    },
    async listSources() {
      const response = await send('/api/rss/sources')
      const data = await readResponse<{ sources?: RssSourceDto[] }>(response)
      return Array.isArray(data.sources) ? data.sources : []
    },
    async listItems() {
      const response = await send('/api/rss/items')
      const data = await readResponse<{ items?: RssItemDto[] }>(response)
      return Array.isArray(data.items) ? data.items : []
    },
    async getItem(id: string) {
      return readResponse<RssItemDetailDto>(await send(`/api/rss/items/${id}`))
    },
    async updateSource(id: string, changes: Partial<Pick<RssSourceDto, 'status' | 'frequency'>>) {
      return readResponse<RssSourceDto>(await send(`/api/rss/sources/${id}`, {
        method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(changes),
      }))
    },
    async runSource(id: string) {
      await readResponse<{ accepted: true }>(await send(`/api/rss/sources/${id}/run`, { method: 'POST' }))
    },
  }
}

export const rssApi = createRssApi()

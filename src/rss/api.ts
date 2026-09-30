import { RssApiError, type ConnectRssResponse, type RssInitialMode, type RssItemDto, type RssSourceDto } from './types'

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
      return (await readResponse<{ sources: RssSourceDto[] }>(response)).sources
    },
    async listItems() {
      const response = await send('/api/rss/items')
      return (await readResponse<{ items: RssItemDto[] }>(response)).items
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

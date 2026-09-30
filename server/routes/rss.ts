import type { FastifyInstance } from 'fastify'
import { z } from 'zod'

const connectSchema = z.object({ url: z.string().url(), initialMode: z.enum(['latest-20', 'from-now']) })
const settingsSchema = z.object({
  status: z.enum(['active', 'paused']).optional(),
  frequency: z.enum(['adaptive', 'immediate', 'daily', 'weekly', 'manual']).optional(),
}).refine((value) => value.status || value.frequency)

export interface RssRouteDependencies {
  service: {
    connectFeed(url: string, mode: 'latest-20' | 'from-now'): Promise<{ id: string } & Record<string, unknown>>
    refreshSource(id: string): Promise<unknown>
  }
  repository: {
    listSources(): Promise<unknown[]>
    listVisibleItems(input?: { sourceId?: string }): Promise<unknown[]>
    getItemWithEvidence(id: string): Promise<unknown | null>
    updateSourceSettings(id: string, input: z.infer<typeof settingsSchema>): Promise<unknown | null>
  }
}

const requestError = () => ({ error: { code: 'INVALID_REQUEST', message: '请求内容无效' } })

export async function registerRssRoutes(app: FastifyInstance, deps: RssRouteDependencies) {
  app.post('/api/rss/sources', async (request, reply) => {
    const parsed = connectSchema.safeParse(request.body)
    if (!parsed.success) return reply.status(400).send(requestError())
    const source = await deps.service.connectFeed(parsed.data.url, parsed.data.initialMode)
    const initialItems = await deps.repository.listVisibleItems({ sourceId: source.id })
    return reply.status(201).send({ source, initialItems })
  })

  app.get('/api/rss/sources', async () => ({ sources: await deps.repository.listSources() }))
  app.get('/api/rss/items', async () => ({ items: await deps.repository.listVisibleItems() }))
  app.get<{ Params: { id: string } }>('/api/rss/items/:id', async (request, reply) => {
    const item = await deps.repository.getItemWithEvidence(request.params.id)
    return item ?? reply.status(404).send({ error: { code: 'ITEM_NOT_FOUND', message: '内容不存在' } })
  })
  app.patch<{ Params: { id: string } }>('/api/rss/sources/:id', async (request, reply) => {
    const parsed = settingsSchema.safeParse(request.body)
    if (!parsed.success) return reply.status(400).send(requestError())
    const source = await deps.repository.updateSourceSettings(request.params.id, parsed.data)
    return source ?? reply.status(404).send({ error: { code: 'SOURCE_NOT_FOUND', message: '信源不存在' } })
  })
  app.post<{ Params: { id: string } }>('/api/rss/sources/:id/run', async (request, reply) => {
    await deps.service.refreshSource(request.params.id)
    return reply.status(202).send({ accepted: true })
  })
}

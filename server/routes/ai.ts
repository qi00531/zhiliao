import type { FastifyInstance } from 'fastify'

export interface AiRouteDependencies {
  configured: boolean
  model: string | null
  requeue(itemId: string): Promise<boolean>
}

export async function registerAiRoutes(app: FastifyInstance, ai: AiRouteDependencies) {
  app.get('/api/ai/status', async () => ({ status: ai.configured ? 'ready' : 'not_configured', model: ai.model }))
  app.post<{ Params: { id: string } }>('/api/rss/items/:id/analyze', async (request, reply) => {
    if (!ai.configured) return reply.status(503).send({ error: { code: 'AI_NOT_CONFIGURED', message: '尚未配置 AI' } })
    const found = await ai.requeue(request.params.id)
    if (!found) return reply.status(404).send({ error: { code: 'ITEM_NOT_FOUND', message: '内容不存在' } })
    return reply.status(202).send({ accepted: true })
  })
}

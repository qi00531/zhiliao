import { z } from 'zod'
import { AiAnalysisError, type ContentAnalyzer } from './types'

interface AiConfig { baseUrl: string; apiKey: string; model: string; timeoutMs: number }
type Request = (input: string | URL | Request, init?: RequestInit) => Promise<Response>

const outputSchema = z.object({
  summary: z.string().trim().min(1).max(120),
  relevance: z.enum(['high', 'medium', 'low', 'unknown']),
  reason: z.string().trim().max(80),
})

function safeJson(content: string) {
  const trimmed = content.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  try {
    return outputSchema.parse(JSON.parse(trimmed))
  } catch {
    throw new AiAnalysisError('INVALID_MODEL_OUTPUT', true, '模型返回格式无效')
  }
}

export function createOpenAiCompatibleAnalyzer(config: AiConfig, request: Request = fetch): ContentAnalyzer {
  return {
    async analyze(input) {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), config.timeoutMs)
      try {
        const response = await request(`${config.baseUrl.replace(/\/$/, '')}/chat/completions`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', authorization: `Bearer ${config.apiKey}` },
          signal: controller.signal,
          body: JSON.stringify({
            model: config.model,
            response_format: { type: 'json_object' },
            messages: [
              { role: 'system', content: '只压缩输入信息，不添加建议或事实。返回 JSON：summary 不超过120字，relevance 为 high/medium/low/unknown，reason 不超过80字。没有目标时 relevance 必须为 unknown。' },
              { role: 'user', content: JSON.stringify({ title: input.title, sourceSummary: input.sourceSummary, goal: input.goal ?? null }) },
            ],
          }),
        })
        if (!response.ok) {
          if (response.status === 401 || response.status === 403) throw new AiAnalysisError('AI_AUTH_FAILED', false, '模型鉴权失败')
          if (response.status === 429) throw new AiAnalysisError('AI_RATE_LIMITED', true, '模型请求受限')
          throw new AiAnalysisError('AI_UPSTREAM_FAILED', response.status >= 500, `模型服务返回 ${response.status}`)
        }
        const payload = await response.json() as { choices?: Array<{ message?: { content?: unknown } }> }
        const content = payload.choices?.[0]?.message?.content
        if (typeof content !== 'string') throw new AiAnalysisError('INVALID_MODEL_OUTPUT', true, '模型返回格式无效')
        return { ...safeJson(content), model: config.model }
      } catch (error) {
        if (error instanceof AiAnalysisError) throw error
        if (error instanceof Error && error.name === 'AbortError') throw new AiAnalysisError('AI_TIMEOUT', true, '模型请求超时')
        throw new AiAnalysisError('AI_UPSTREAM_FAILED', true, '模型服务暂时不可用')
      } finally {
        clearTimeout(timer)
      }
    },
  }
}

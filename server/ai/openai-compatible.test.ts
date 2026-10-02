// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { createOpenAiCompatibleAnalyzer } from './openai-compatible'

const config = { baseUrl: 'https://api.example.com/v1', apiKey: 'secret-key', model: 'test-model', timeoutMs: 50 }
const response = (content: string, status = 200) => new Response(status === 200 ? JSON.stringify({ choices: [{ message: { content } }] }) : 'failure', { status, headers: { 'content-type': 'application/json' } })

describe('OpenAI-compatible analyzer', () => {
  it('returns validated structured analysis', async () => {
    const request = vi.fn(async () => response('{"summary":"简短摘要","relevance":"high","reason":"与目标直接相关"}'))
    const analyzer = createOpenAiCompatibleAnalyzer(config, request)
    await expect(analyzer.analyze({ title: 'Update', sourceSummary: 'Details', goal: 'Ship demo' })).resolves.toEqual({
      summary: '简短摘要', relevance: 'high', reason: '与目标直接相关', model: 'test-model',
    })
    expect(request).toHaveBeenCalledWith('https://api.example.com/v1/chat/completions', expect.objectContaining({
      headers: expect.objectContaining({ authorization: 'Bearer secret-key' }),
    }))
  })

  it.each([
    [401, 'AI_AUTH_FAILED', false],
    [429, 'AI_RATE_LIMITED', true],
    [500, 'AI_UPSTREAM_FAILED', true],
  ])('maps HTTP %s to a safe error', async (status, code, retryable) => {
    const analyzer = createOpenAiCompatibleAnalyzer(config, async () => response('', status))
    await expect(analyzer.analyze({ title: 'Update', sourceSummary: 'Details' })).rejects.toMatchObject({ code, retryable })
    await expect(analyzer.analyze({ title: 'Update', sourceSummary: 'Details' })).rejects.not.toThrow('secret-key')
  })

  it('rejects invalid model output', async () => {
    const analyzer = createOpenAiCompatibleAnalyzer(config, async () => response('{"summary":"ok","relevance":"maybe","reason":""}'))
    await expect(analyzer.analyze({ title: 'Update', sourceSummary: 'Details' })).rejects.toMatchObject({ code: 'INVALID_MODEL_OUTPUT', retryable: true })
  })

  it('aborts a timed-out request', async () => {
    const analyzer = createOpenAiCompatibleAnalyzer({ ...config, timeoutMs: 5 }, async (_url, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
    }))
    await expect(analyzer.analyze({ title: 'Update', sourceSummary: 'Details' })).rejects.toMatchObject({ code: 'AI_TIMEOUT', retryable: true })
  })
})

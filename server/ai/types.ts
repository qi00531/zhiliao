export type Relevance = 'high' | 'medium' | 'low' | 'unknown'

export interface AnalysisInput {
  title: string
  sourceSummary: string
  goal?: string
}

export interface AnalysisResult {
  summary: string
  relevance: Relevance
  reason: string
  model: string
}

export interface ContentAnalyzer {
  analyze(input: AnalysisInput): Promise<AnalysisResult>
}

export type AiErrorCode = 'AI_TIMEOUT' | 'AI_AUTH_FAILED' | 'AI_RATE_LIMITED' | 'AI_UPSTREAM_FAILED' | 'INVALID_MODEL_OUTPUT'

export class AiAnalysisError extends Error {
  constructor(public readonly code: AiErrorCode, public readonly retryable: boolean, message: string) {
    super(message)
    this.name = 'AiAnalysisError'
  }
}

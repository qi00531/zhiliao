import { routeSignals } from '../domain/attention-router'
import type { AnalyzeRequest, AttentionAnalyzer, Briefing } from '../domain/types'

export class DemoAttentionAnalyzer implements AttentionAnalyzer {
  async analyze(request: AnalyzeRequest): Promise<Briefing> {
    await new Promise((resolve) => window.setTimeout(resolve, 1100))
    return routeSignals(request.signals, request.budget)
  }
}

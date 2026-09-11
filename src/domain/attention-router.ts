import type { AttentionBudget, AttentionSignal, Briefing } from './types'

const budgetSize: Record<AttentionBudget, number> = {
  'one-minute': 3,
  'three-minutes': 5,
  'deep-dive': Number.POSITIVE_INFINITY,
}

export function routeSignals(
  signals: AttentionSignal[],
  budget: AttentionBudget,
): Briefing {
  const actionable = signals
    .filter((signal) => signal.disposition === 'unread' && signal.kind !== 'known')
    .sort((a, b) => b.score - a.score)

  const now = actionable.slice(0, budgetSize[budget])
  const nowIds = new Set(now.map((signal) => signal.id))

  return {
    now,
    later: signals
      .filter(
        (signal) =>
          signal.disposition === 'later' ||
          (signal.disposition === 'unread' && signal.kind !== 'known' && !nowIds.has(signal.id)),
      )
      .sort((a, b) => b.score - a.score),
    archive: signals.filter(
      (signal) => signal.disposition === 'known' || signal.kind === 'known',
    ),
  }
}

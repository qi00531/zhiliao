import { describe, expect, it } from 'vitest'
import { demoSignals } from '../demo/demo-data'
import { routeSignals } from './attention-router'

describe('routeSignals', () => {
  it('keeps the one-minute briefing to the three highest-value signals', () => {
    const result = routeSignals(demoSignals, 'one-minute')

    expect(result.now.map((signal) => signal.id)).toEqual([
      'team-deadline',
      'poster-change',
      'public-github',
    ])
    expect(result.now).toHaveLength(3)
  })

  it('does not spend attention on acknowledged or duplicate information', () => {
    const result = routeSignals(
      demoSignals.map((signal) =>
        signal.id === 'team-deadline' ? { ...signal, disposition: 'known' as const } : signal,
      ),
      'one-minute',
    )

    expect(result.now.map((signal) => signal.id)).not.toContain('team-deadline')
    expect(result.archive.map((signal) => signal.id)).toContain('team-deadline')
  })

  it('keeps deferred information in later', () => {
    const result = routeSignals(
      demoSignals.map((signal) =>
        signal.id === 'public-github' ? { ...signal, disposition: 'later' as const } : signal,
      ),
      'one-minute',
    )

    expect(result.now.map((signal) => signal.id)).not.toContain('public-github')
    expect(result.later.map((signal) => signal.id)).toContain('public-github')
  })
})

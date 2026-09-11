import { describe, expect, it } from 'vitest'
import { archiveAction, createKnowledgeItem, groupPosterAction } from './knowledge'
import { demoFacts, demoSources } from '../demo/demo-data'

describe('knowledge domain', () => {
  it('groups poster requirements and changes into one action', () => {
    const action = groupPosterAction(demoFacts)

    expect(action.title).toBe('完成黑客松海报')
    expect(action.factIds).toEqual([
      'poster-format',
      'poster-resolution',
      'poster-finish-deadline',
      'poster-submit-deadline',
    ])
    expect(action.changeCount).toBe(1)
  })

  it('archives only sources cited by the completed action', () => {
    const action = groupPosterAction(demoFacts)
    const archive = archiveAction(action, demoFacts, demoSources)

    expect(archive.sourceIds).toEqual(['rules', 'schedule', 'team'])
    expect(archive.status).toBe('completed')
  })

  it('creates knowledge with referenced sources and one summary', () => {
    const knowledge = createKnowledgeItem(
      'poster-knowledge',
      '黑客松展示海报要求',
      '参赛海报应采用 A3 竖版画布并以 300 DPI 导出。',
      demoFacts.filter((fact) => fact.id.startsWith('poster-')),
    )

    expect(knowledge.summary).toBe('参赛海报应采用 A3 竖版画布并以 300 DPI 导出。')
    expect(knowledge.sourceIds).toEqual(['rules', 'schedule', 'team'])
  })
})

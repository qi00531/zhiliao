import type { ActionAggregate, EventArchive, Fact, KnowledgeItem, Source } from './types'

export function groupPosterAction(facts: Fact[]): ActionAggregate {
  const factIds = facts.filter((fact) => fact.id.startsWith('poster-')).map((fact) => fact.id)
  return {
    id: 'make-poster',
    title: '完成黑客松海报',
    deadline: '今晚 23:00 前',
    factIds,
    changeCount: facts.reduce((count, fact) => count + fact.revisions.length, 0),
    status: 'active',
    watched: true,
  }
}

export function archiveAction(
  action: ActionAggregate,
  facts: Fact[],
  sources: Source[],
): EventArchive {
  const used = new Set(
    facts.filter((fact) => action.factIds.includes(fact.id)).flatMap((fact) => fact.sourceIds),
  )
  return {
    ...action,
    status: 'completed',
    watched: false,
    completedAt: '今天 14:18',
    sourceIds: sources.filter((source) => used.has(source.id)).map((source) => source.id),
  }
}

export function createKnowledgeItem(
  id: string,
  title: string,
  summary: string,
  facts: Fact[],
): KnowledgeItem {
  return {
    id,
    title,
    summary,
    factIds: facts.map((fact) => fact.id),
    sourceIds: [...new Set(facts.flatMap((fact) => fact.sourceIds))].sort(),
    categories: ['黑客松', '设计交付'],
    relatedIds: [],
  }
}

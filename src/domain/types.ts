export type AttentionBudget = 'one-minute' | 'three-minutes' | 'deep-dive'
export type SignalKind = 'action' | 'changed' | 'new' | 'known'
export type SignalDisposition = 'unread' | 'later' | 'known'
export type SourceKind = 'pdf' | 'image' | 'url' | 'text'

export interface Source {
  id: string
  name: string
  kind: SourceKind
  detail: string
  selected: boolean
  target?: EvidenceTarget
}

export interface EvidenceTarget {
  kind: SourceKind
  locator: string
  excerpt: string
  preview: string
}

export interface Revision {
  id: string
  previousValue: string
  currentValue: string
  observedAt: string
  sourceIds: string[]
}

export interface Fact {
  id: string
  label: string
  value: string
  sourceIds: string[]
  revisions: Revision[]
  reusable: boolean
}

export interface ActionAggregate {
  id: string
  title: string
  deadline: string
  factIds: string[]
  changeCount: number
  status: 'active' | 'completed'
  watched: boolean
}

export interface EventArchive extends ActionAggregate {
  completedAt: string
  sourceIds: string[]
}

export interface KnowledgeItem {
  id: string
  title: string
  summary: string
  factIds: string[]
  sourceIds: string[]
  categories: string[]
  relatedIds: string[]
}

export type WatchFrequency = 'adaptive' | 'immediate' | 'daily' | 'weekly' | 'manual'

export interface AttentionSignal {
  id: string
  kind: SignalKind
  title: string
  reason: string
  source: string
  locator: string
  evidence: string
  score: number
  disposition: SignalDisposition
}

export interface Briefing {
  now: AttentionSignal[]
  later: AttentionSignal[]
  archive: AttentionSignal[]
}

export interface AnalyzeRequest {
  goal: string
  budget: AttentionBudget
  sources: Source[]
  signals: AttentionSignal[]
}

export interface AttentionAnalyzer {
  analyze(request: AnalyzeRequest): Promise<Briefing>
}

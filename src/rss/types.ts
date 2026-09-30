export type RssInitialMode = 'latest-20' | 'from-now'
export type RssFrequency = 'adaptive' | 'immediate' | 'daily' | 'weekly' | 'manual'

export interface RssSourceDto {
  id: string
  title: string
  url: string
  siteUrl?: string | null
  status: 'active' | 'paused' | 'error'
  frequency: RssFrequency
  lastSuccessAt?: string | null
  lastErrorMessage?: string | null
}

export interface RssItemDto {
  id: string
  sourceId: string
  sourceTitle: string
  title: string
  url: string | null
  summaryText: string
  publishedAt: string | null
  firstSeenAt: string
  initialImport: boolean
}

export interface ConnectRssResponse {
  source: RssSourceDto
  initialItems: RssItemDto[]
}

export class RssApiError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message)
    this.name = 'RssApiError'
  }
}

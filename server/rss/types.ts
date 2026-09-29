export interface NormalizedFeedItem {
  externalId: string
  url: string | null
  title: string
  author: string | null
  summaryText: string
  publishedAt: Date | null
  contentHash: string
}

export interface NormalizedFeed {
  title: string
  siteUrl: string | null
  ttlMinutes: number | null
  items: NormalizedFeedItem[]
}

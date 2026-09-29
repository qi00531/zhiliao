import { XMLParser, XMLValidator } from 'fast-xml-parser'
import { contentFingerprint, sha256 } from './fingerprint'
import type { NormalizedFeed, NormalizedFeedItem } from './types'

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  removeNSPrefix: true,
  trimValues: true,
  parseTagValue: false,
})

const array = <T>(value: T | T[] | undefined): T[] => value === undefined ? [] : Array.isArray(value) ? value : [value]
const text = (value: unknown): string => {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  if (typeof value === 'object' && '#text' in value) return text((value as Record<string, unknown>)['#text'])
  return ''
}

function plainText(value: unknown) {
  const source = text(value)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/\s+/g, ' ')
    .trim()
  return source.slice(0, 8_000)
}

function absoluteUrl(value: unknown, base: string): string | null {
  const candidate = text(value)
  if (!candidate) return null
  try {
    const url = new URL(candidate, base)
    url.hash = ''
    return url.toString()
  } catch {
    return null
  }
}

function date(value: unknown) {
  const raw = text(value)
  if (!raw) return null
  const parsed = new Date(raw)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function identity(guid: unknown, url: string | null, title: string, publishedAt: Date | null) {
  const stableGuid = text(guid)
  if (stableGuid) return `guid:${stableGuid}`
  if (url) return `url:${url}`
  return `hash:${sha256(`${title}\n${publishedAt?.toISOString() ?? ''}`)}`
}

function normalizedItem(input: {
  guid?: unknown; url?: unknown; title?: unknown; author?: unknown; summary?: unknown; published?: unknown
}, base: string): NormalizedFeedItem {
  const url = absoluteUrl(input.url, base)
  const title = plainText(input.title) || '未命名内容'
  const summaryText = plainText(input.summary)
  const publishedAt = date(input.published)
  return {
    externalId: identity(input.guid, url, title, publishedAt),
    url,
    title,
    author: plainText(input.author) || null,
    summaryText,
    publishedAt,
    contentHash: contentFingerprint(title, summaryText, url),
  }
}

function atomLink(value: unknown, relation = 'alternate') {
  const links = array(value as Record<string, unknown> | Record<string, unknown>[] | undefined)
  return links.find((link) => !link['@_rel'] || link['@_rel'] === relation)?.['@_href']
    ?? links[0]?.['@_href']
}

function parseJsonFeed(body: string, feedUrl: string): NormalizedFeed {
  const feed = JSON.parse(body) as Record<string, unknown>
  if (typeof feed.version !== 'string' || !feed.version.includes('jsonfeed.org/version/')) throw new Error('UNSUPPORTED_FEED')
  const items = array(feed.items as Record<string, unknown>[] | undefined).map((item) => normalizedItem({
    guid: item.id,
    url: item.url ?? item.external_url,
    title: item.title,
    author: array(item.authors as Record<string, unknown>[] | undefined)[0]?.name,
    summary: item.summary ?? item.content_text ?? item.content_html,
    published: item.date_published ?? item.date_modified,
  }, feedUrl))
  return {
    title: plainText(feed.title) || new URL(feedUrl).hostname,
    siteUrl: absoluteUrl(feed.home_page_url, feedUrl),
    ttlMinutes: null,
    items,
  }
}

function parseXmlFeed(body: string, feedUrl: string): NormalizedFeed {
  if (/<!DOCTYPE|<!ENTITY/i.test(body)) throw new Error('UNSAFE_XML')
  if (XMLValidator.validate(body) !== true) throw new Error('INVALID_XML')
  const root = xmlParser.parse(body) as Record<string, any>
  if (root.rss?.channel) {
    const channel = root.rss.channel
    return {
      title: plainText(channel.title) || new URL(feedUrl).hostname,
      siteUrl: absoluteUrl(channel.link, feedUrl),
      ttlMinutes: Number.isFinite(Number(text(channel.ttl))) ? Number(text(channel.ttl)) : null,
      items: array<Record<string, unknown>>(channel.item).map((item) => normalizedItem({
        guid: item.guid, url: item.link, title: item.title,
        author: item.author ?? (item.creator as unknown),
        summary: item.description ?? item.encoded,
        published: item.pubDate ?? item.date,
      }, feedUrl)),
    }
  }
  if (root.feed) {
    const feed = root.feed
    return {
      title: plainText(feed.title) || new URL(feedUrl).hostname,
      siteUrl: absoluteUrl(atomLink(feed.link), feedUrl),
      ttlMinutes: null,
      items: array<Record<string, any>>(feed.entry).map((item) => normalizedItem({
        guid: item.id, url: atomLink(item.link), title: item.title,
        author: item.author?.name ?? item.author,
        summary: item.summary ?? item.content,
        published: item.published ?? item.updated,
      }, feedUrl)),
    }
  }
  throw new Error('UNSUPPORTED_FEED')
}

export function parseFeed(body: string, contentType: string, feedUrl: string) {
  if (contentType.includes('json') || body.trimStart().startsWith('{')) return parseJsonFeed(body, feedUrl)
  return parseXmlFeed(body, feedUrl)
}

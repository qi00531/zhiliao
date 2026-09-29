// @vitest-environment node
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseFeed } from './parse-feed'

const fixture = (name: string) => readFile(join(process.cwd(), 'server/test/fixtures', name), 'utf8')
const feedUrl = 'https://example.com/feed.xml'

describe('parseFeed', () => {
  it('normalizes RSS 2.0 and strips untrusted HTML', async () => {
    const feed = parseFeed(await fixture('rss.xml'), 'application/rss+xml', feedUrl)
    expect(feed).toMatchObject({ title: 'Example', siteUrl: 'https://example.com/', ttlMinutes: 60 })
    expect(feed.items[0]).toMatchObject({
      externalId: 'guid:entry-1', url: 'https://example.com/posts/1', title: 'First entry',
      author: 'Ada', summaryText: 'Plain & useful summary',
    })
  })

  it('normalizes Atom links, authors, and timestamps', async () => {
    const feed = parseFeed(await fixture('atom.xml'), 'application/atom+xml', feedUrl)
    expect(feed.items[0]).toMatchObject({
      externalId: 'guid:tag:example.com,2026:1', url: 'https://example.com/atom/1',
      author: 'Lin', publishedAt: new Date('2026-09-20T09:00:00Z'),
    })
  })

  it('normalizes JSON Feed', async () => {
    const feed = parseFeed(await fixture('feed.json'), 'application/feed+json', feedUrl)
    expect(feed.title).toBe('JSON Example')
    expect(feed.items[0]).toMatchObject({ externalId: 'guid:json-1', summaryText: 'JSON summary' })
  })

  it('uses a canonical URL identity when an item has no guid', () => {
    const xml = '<rss><channel><title>X</title><item><title>One</title><link>https://example.com/one#top</link></item></channel></rss>'
    expect(parseFeed(xml, 'application/rss+xml', feedUrl).items[0].externalId).toBe('url:https://example.com/one')
  })

  it.each(['<!DOCTYPE rss><rss/>', '<!ENTITY x "boom"><rss/>'])('rejects unsafe XML %s', (xml) => {
    expect(() => parseFeed(xml, 'application/rss+xml', feedUrl)).toThrow('UNSAFE_XML')
  })

  it('rejects malformed or unsupported content', () => {
    expect(() => parseFeed('<rss>', 'application/rss+xml', feedUrl)).toThrow()
    expect(() => parseFeed('{}', 'application/json', feedUrl)).toThrow('UNSUPPORTED_FEED')
  })
})

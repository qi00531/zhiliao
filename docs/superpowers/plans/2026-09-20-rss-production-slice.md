# RSS Production Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a real self-hostable RSS vertical slice in which a user enters a Feed URL, the server stores a baseline, polls incrementally, and the existing concise Web UI displays new items with clickable evidence.

**Architecture:** Keep the React/Vite client at the repository root and add a TypeScript modular monolith under `server/`. One Fastify process exposes the API and starts an independently bounded polling worker; PostgreSQL stores sources, items, revisions, fetch runs, and evidence. Collection is deterministic and AI-free. The first delivery is single-workspace and binds to loopback by default; it must not be exposed publicly until a separate authentication plan is implemented or deployment-level access control is enabled.

**Tech Stack:** React 19, Vite, TypeScript, Fastify, PostgreSQL, `pg`, `fast-xml-parser`, Zod, Vitest, Testing Library, Docker Compose.

---

## Scope boundary

This plan implements only stage 1 of the approved design:

- manual RSS/Atom/JSON Feed URL input;
- latest-20 baseline or “start now”;
- incremental fetch, conditional requests, deduplication, revisions, fetch status, and evidence;
- adaptive polling without Redis;
- a minimal source-management view and live homepage items;
- SSRF, XML-size, timeout, redirect, and untrusted-HTML protections.

It does not implement website Feed discovery, curated one-click sources, generic webpage monitoring, user memory, automatic research, search findings, or knowledge-library writes. Those remain separate implementation plans.

## File map

```text
server/
  app.ts                         Fastify composition and lifecycle
  index.ts                       process entrypoint
  config.ts                      validated environment configuration
  db/pool.ts                     PostgreSQL pool
  db/migrate.ts                  SQL migration runner
  db/migrations/001_rss.sql      RSS persistence schema
  rss/types.ts                   normalized RSS domain types
  rss/url-policy.ts              public-network URL validation
  rss/fetch-feed.ts              bounded conditional HTTP fetch
  rss/parse-feed.ts              RSS/Atom/JSON Feed normalization
  rss/fingerprint.ts             stable identity and content hashes
  rss/repository.ts              RSS persistence queries
  rss/ingest.ts                  baseline and incremental transaction
  rss/scheduler.ts               adaptive due-source polling
  routes/rss.ts                  HTTP request/response boundary
  test/helpers.ts                test database reset and fixtures
  test/fixtures/*.xml|json       deterministic Feed samples
src/
  rss/types.ts                   client DTOs
  rss/api.ts                     typed API client
  rss/useRss.ts                  loading and mutation state
  rss/RssSourceDrawer.tsx        manual source connection UI
  rss/RssItem.tsx                concise homepage item
  rss/RssSourcesSettings.tsx     source status and pause controls
  rss/*.test.tsx                 UI behavior tests
docker-compose.yml               local PostgreSQL
.env.example                     safe local defaults
```

## API contract

```text
POST   /api/rss/sources          preview and connect a Feed
GET    /api/rss/sources          list connected sources and health
PATCH  /api/rss/sources/:id      pause, resume, or change frequency
POST   /api/rss/sources/:id/run  request an immediate fetch
GET    /api/rss/items            list displayable items, newest first
GET    /api/rss/items/:id        get content, revisions, and evidence
GET    /health                   database and worker health
```

`POST /api/rss/sources` body:

```ts
{
  url: string
  initialMode: 'latest-20' | 'from-now'
}
```

The response contains the source plus at most three baseline items marked `initialImport: true`. All later items use `initialImport: false`.

---

### Task 1: Add the server toolchain and local PostgreSQL

**Files:**
- Modify: `package.json`
- Modify: `tsconfig.node.json`
- Create: `.env.example`
- Create: `docker-compose.yml`
- Create: `server/config.ts`
- Test: `server/config.test.ts`

- [ ] **Step 1: Write the failing config test**

```ts
import { describe, expect, it } from 'vitest'
import { readConfig } from './config'

describe('readConfig', () => {
  it('binds to loopback and rejects a missing database URL', () => {
    expect(() => readConfig({})).toThrow('DATABASE_URL')
    expect(readConfig({ DATABASE_URL: 'postgres://local/test' }).host).toBe('127.0.0.1')
  })
})
```

- [ ] **Step 2: Run the test and verify the missing module failure**

Run: `npm test -- server/config.test.ts`

Expected: FAIL because `server/config.ts` does not exist.

- [ ] **Step 3: Install and configure the server dependencies**

Run:

```bash
npm install fastify @fastify/static pg fast-xml-parser zod
npm install -D @types/pg tsx
```

Add scripts to `package.json`:

```json
{
  "server:dev": "tsx watch server/index.ts",
  "server:start": "tsx server/index.ts",
  "db:migrate": "tsx server/db/migrate.ts",
  "dev:all": "concurrently -k \"npm run dev\" \"npm run server:dev\""
}
```

Install `concurrently` as a dev dependency. Extend `tsconfig.node.json` to include `server/**/*.ts` and Node types.

Create `.env.example` with `DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/zhiliao`, `HOST=127.0.0.1`, `PORT=8787`, `WEB_ORIGIN=http://127.0.0.1:5173`, `RSS_FETCH_TIMEOUT_MS=10000`, and `RSS_MAX_BYTES=2097152`.

Create `docker-compose.yml` with PostgreSQL 17, a named volume, healthcheck, and port `5432` bound to `127.0.0.1`.

- [ ] **Step 4: Implement validated configuration**

```ts
import { z } from 'zod'

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  HOST: z.string().default('127.0.0.1'),
  PORT: z.coerce.number().int().positive().default(8787),
  WEB_ORIGIN: z.string().url().default('http://127.0.0.1:5173'),
  RSS_FETCH_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),
  RSS_MAX_BYTES: z.coerce.number().int().positive().max(10_485_760).default(2_097_152),
})

export const readConfig = (env: NodeJS.ProcessEnv) => {
  const value = schema.parse(env)
  return {
    databaseUrl: value.DATABASE_URL,
    host: value.HOST,
    port: value.PORT,
    webOrigin: value.WEB_ORIGIN,
    fetchTimeoutMs: value.RSS_FETCH_TIMEOUT_MS,
    maxFeedBytes: value.RSS_MAX_BYTES,
  }
}
```

- [ ] **Step 5: Run the test and commit**

Run: `npm test -- server/config.test.ts`

Expected: PASS.

```bash
git add package.json package-lock.json tsconfig.node.json .env.example docker-compose.yml server/config.ts server/config.test.ts
git commit -m "chore: scaffold RSS server runtime"
```

### Task 2: Create the PostgreSQL schema and migration runner

**Files:**
- Create: `server/db/pool.ts`
- Create: `server/db/migrate.ts`
- Create: `server/db/migrations/001_rss.sql`
- Create: `server/db/schema.test.ts`

- [ ] **Step 1: Write a schema integration test**

The test must migrate a disposable test database, insert one source and one item, verify the uniqueness of `(source_id, external_id)`, and verify that deleting a source cascades to items and evidence.

```ts
it('enforces RSS identity and evidence ownership', async () => {
  const source = await insertTestSource(pool)
  await insertTestItem(pool, source.id, 'guid:1')
  await expect(insertTestItem(pool, source.id, 'guid:1')).rejects.toThrow()
  await pool.query('delete from rss_sources where id = $1', [source.id])
  expect(await countRows(pool, 'rss_items')).toBe(0)
})
```

- [ ] **Step 2: Run the test and verify failure**

Run: `TEST_DATABASE_URL=$DATABASE_URL npm test -- server/db/schema.test.ts`

Expected: FAIL because the migration and helpers do not exist.

- [ ] **Step 3: Add the migration**

`001_rss.sql` must create:

- `schema_migrations(version primary key, applied_at)`;
- `rss_sources(id uuid, workspace_id text default 'default', url, canonical_url, title, site_url, status, frequency, etag, last_modified, next_fetch_at, last_success_at, last_error_code, last_error_message, created_at, updated_at)`;
- `rss_items(id uuid, source_id, external_id, url, title, author, summary_text, published_at, first_seen_at, initial_import, visible_on_home, current_content_hash)`;
- `rss_item_revisions(id uuid, item_id, content_hash, title, summary_text, observed_at)`;
- `rss_evidence(id uuid, item_id, source_id, url, title, excerpt, captured_at)`;
- `rss_fetch_runs(id uuid, source_id, started_at, finished_at, outcome, http_status, item_count, error_code, error_message)`.

Add unique indexes on source canonical URL, `(source_id, external_id)`, `(item_id, content_hash)`, and evidence identity. Add due-source and newest-item indexes. Use check constraints for source status, frequency, and fetch outcome.

- [ ] **Step 4: Implement a transactional migration runner**

`migrate.ts` must read sorted `.sql` files, acquire a PostgreSQL advisory lock, apply only unseen versions in a transaction, and release the client in `finally`. `pool.ts` exports a lazily created `pg.Pool` from validated config.

- [ ] **Step 5: Run the integration test and commit**

Run:

```bash
docker compose up -d db
npm run db:migrate
TEST_DATABASE_URL=$DATABASE_URL npm test -- server/db/schema.test.ts
```

Expected: migration completes and the schema test passes.

```bash
git add server/db docker-compose.yml
git commit -m "feat: add RSS persistence schema"
```

### Task 3: Normalize and validate Feed URLs safely

**Files:**
- Create: `server/rss/url-policy.ts`
- Test: `server/rss/url-policy.test.ts`

- [ ] **Step 1: Write table-driven failing tests**

```ts
it.each([
  ['http://127.0.0.1/feed', false],
  ['http://169.254.169.254/latest/meta-data', false],
  ['file:///etc/passwd', false],
  ['https://example.com/feed#part', true],
])('%s allowed=%s', async (url, allowed) => {
  await expect(isPublicHttpUrl(url)).resolves.toBe(allowed)
})
```

Also test IPv6 loopback, RFC1918 networks, credentials in URLs, DNS resolving to private IPs, mixed public/private answers, and a redirect from public to private.

- [ ] **Step 2: Run and verify failure**

Run: `npm test -- server/rss/url-policy.test.ts`

Expected: FAIL because `isPublicHttpUrl` is missing.

- [ ] **Step 3: Implement URL policy**

Accept only `http:` and `https:`, reject embedded credentials, strip fragments, normalize default ports and hostname case, resolve every A/AAAA answer with `node:dns/promises`, and reject if any address is loopback, private, link-local, multicast, unspecified, documentation-only, or cloud metadata. Export `normalizeFeedUrl`, `assertPublicHttpUrl`, and an injectable resolver for tests.

- [ ] **Step 4: Run tests and commit**

Run: `npm test -- server/rss/url-policy.test.ts`

Expected: all URL policy cases pass.

```bash
git add server/rss/url-policy.ts server/rss/url-policy.test.ts
git commit -m "feat: protect RSS fetching from private networks"
```

### Task 4: Fetch and parse RSS, Atom, and JSON Feed

**Files:**
- Create: `server/rss/types.ts`
- Create: `server/rss/fetch-feed.ts`
- Create: `server/rss/parse-feed.ts`
- Create: `server/rss/fingerprint.ts`
- Create: `server/test/fixtures/rss.xml`
- Create: `server/test/fixtures/atom.xml`
- Create: `server/test/fixtures/feed.json`
- Test: `server/rss/fetch-feed.test.ts`
- Test: `server/rss/parse-feed.test.ts`

- [ ] **Step 1: Define the expected normalized output in failing tests**

```ts
expect(parseFeed(rssFixture, 'application/rss+xml', feedUrl)).toEqual({
  title: 'Example',
  siteUrl: 'https://example.com/',
  ttlMinutes: 60,
  items: [expect.objectContaining({
    externalId: 'guid:entry-1',
    url: 'https://example.com/posts/1',
    title: 'First entry',
    summaryText: 'Plain summary',
  })],
})
```

Tests must cover namespace-prefixed Atom elements, CDATA, missing GUID fallback to canonical URL, relative links, invalid XML, DOCTYPE/entity rejection, and equivalent JSON Feed fields.

- [ ] **Step 2: Run and verify failure**

Run: `npm test -- server/rss/parse-feed.test.ts server/rss/fetch-feed.test.ts`

Expected: FAIL because parser and fetcher modules are missing.

- [ ] **Step 3: Implement normalized types and fingerprints**

```ts
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
```

Use SHA-256 for identity and content hashes. Strip HTML to plain text, decode entities, collapse whitespace, and cap stored summaries at 8,000 characters. Do not store or render raw Feed HTML.

- [ ] **Step 4: Implement bounded fetching and parsing**

`fetchFeed` must call `assertPublicHttpUrl` before every request and redirect, send `If-None-Match` and `If-Modified-Since`, use `AbortSignal.timeout`, accept at most five redirects, stream with a byte counter, reject responses larger than `RSS_MAX_BYTES`, and return a discriminated union for `not-modified`, `fetched`, and typed failure. Disable XML external entities and reject any `<!DOCTYPE` or `<!ENTITY` input before parsing.

- [ ] **Step 5: Run tests and commit**

Run: `npm test -- server/rss/parse-feed.test.ts server/rss/fetch-feed.test.ts`

Expected: RSS, Atom, JSON Feed, conditional request, redirect, timeout, size, and XML-safety tests pass.

```bash
git add server/rss server/test/fixtures
git commit -m "feat: fetch and normalize standard feeds"
```

### Task 5: Implement baseline and incremental ingestion

**Files:**
- Create: `server/rss/repository.ts`
- Create: `server/rss/ingest.ts`
- Test: `server/rss/ingest.test.ts`

- [ ] **Step 1: Write failing transaction tests**

Cover these cases explicitly: twenty stored baseline items with only three visible initial imports; a from-now baseline with no visible history; one later item; content revision without duplication; unchanged ETag and cursor after failure; and an idempotent retry. Use the same concrete fixture builder in every case. The first test must contain these assertions:

```ts
const source = await service.connectFeed('https://example.com/feed.xml', 'latest-20')
expect(await repository.countItems(source.id)).toBe(20)
const visible = await repository.listVisibleItems({ sourceId: source.id })
expect(visible).toHaveLength(3)
expect(visible.every((item) => item.initialImport)).toBe(true)
```

- [ ] **Step 2: Run and verify failure**

Run: `TEST_DATABASE_URL=$DATABASE_URL npm test -- server/rss/ingest.test.ts`

Expected: FAIL because the repository and service are missing.

- [ ] **Step 3: Implement repository methods**

Create explicit methods for `createSource`, `findSourceByCanonicalUrl`, `listDueSources`, `recordFetchStart`, `commitSuccessfulFetch`, `recordFetchFailure`, `listVisibleItems`, `getItemWithEvidence`, and `updateSourceSettings`. All multi-table writes use one checked-out client and transaction.

- [ ] **Step 4: Implement ingestion semantics**

`connectFeed(url, initialMode)` fetches and parses before creating a source, sorts items by published time then source order, stores at most 20, and marks every stored baseline item as `initial_import`, marks only the newest three `visible_on_home`, and marks no history visible when mode is `from-now`. `refreshSource(id)` locks the source row, performs the conditional fetch, upserts new item identities with `visible_on_home = true`, appends revisions for changed hashes, creates one evidence row per item URL, and advances ETag/Last-Modified only after the transaction succeeds.

Calculate the next run from Feed TTL when present, otherwise from update history, bounded between 15 minutes and 24 hours. Consecutive failures use exponential backoff capped at 24 hours.

- [ ] **Step 5: Run tests and commit**

Run: `TEST_DATABASE_URL=$DATABASE_URL npm test -- server/rss/ingest.test.ts`

Expected: all baseline, retry, revision, failure, and deduplication tests pass.

```bash
git add server/rss/repository.ts server/rss/ingest.ts server/rss/ingest.test.ts
git commit -m "feat: ingest RSS baselines and incremental updates"
```

### Task 6: Add scheduler, API routes, and health reporting

**Files:**
- Create: `server/rss/scheduler.ts`
- Create: `server/routes/rss.ts`
- Create: `server/app.ts`
- Create: `server/index.ts`
- Test: `server/routes/rss.test.ts`
- Test: `server/rss/scheduler.test.ts`

- [ ] **Step 1: Write failing API and scheduler tests**

Use Fastify `inject()` and a fake ingestion service. Verify request validation, duplicate-source conflict, source list health, item ordering, item evidence, pause/resume, manual run, and structured errors. Verify the scheduler claims due sources with `FOR UPDATE SKIP LOCKED`, limits concurrency, and stops cleanly.

```ts
const response = await app.inject({
  method: 'POST',
  url: '/api/rss/sources',
  payload: { url: 'https://example.com/feed.xml', initialMode: 'latest-20' },
})
expect(response.statusCode).toBe(201)
expect(response.json().initialItems).toHaveLength(3)
```

- [ ] **Step 2: Run and verify failure**

Run: `npm test -- server/routes/rss.test.ts server/rss/scheduler.test.ts`

Expected: FAIL because routes and scheduler do not exist.

- [ ] **Step 3: Implement the bounded scheduler**

Poll due work every 30 seconds, claim at most five sources per pass, run at most two fetches concurrently in the first release, and release all timers during Fastify shutdown. A worker crash must leave database state retryable rather than marking a source current.

- [ ] **Step 4: Implement routes and application composition**

Validate every body and parameter with Zod. Return stable error codes including `INVALID_URL`, `PRIVATE_NETWORK_URL`, `UNSUPPORTED_FEED`, `FEED_TOO_LARGE`, `FETCH_TIMEOUT`, `SOURCE_EXISTS`, and `SOURCE_NOT_FOUND`. In development, permit only `WEB_ORIGIN`; in production serve `dist/` from Fastify. `/health` reports `ok`, `degraded`, or `unavailable` based on database access and the worker heartbeat without exposing secrets.

- [ ] **Step 5: Run tests and commit**

Run: `npm test -- server/routes/rss.test.ts server/rss/scheduler.test.ts`

Expected: route contract and lifecycle tests pass.

```bash
git add server/app.ts server/index.ts server/routes server/rss/scheduler.ts server/routes/rss.test.ts server/rss/scheduler.test.ts
git commit -m "feat: expose RSS API and polling worker"
```

### Task 7: Add the typed Web client and manual RSS connection flow

**Files:**
- Create: `src/rss/types.ts`
- Create: `src/rss/api.ts`
- Create: `src/rss/useRss.ts`
- Create: `src/rss/RssSourceDrawer.tsx`
- Test: `src/rss/RssSourceDrawer.test.tsx`
- Modify: `vite.config.ts`
- Modify: `src/App.tsx`

- [ ] **Step 1: Write the failing interaction test**

```ts
it('connects an RSS URL without replacing the existing import entry', async () => {
  render(<App />)
  await user.click(screen.getByRole('button', { name: '导入新信息' }))
  await user.click(screen.getByRole('button', { name: 'RSS' }))
  await user.type(screen.getByLabelText('RSS 地址'), 'https://example.com/feed.xml')
  await user.click(screen.getByRole('button', { name: '接入' }))
  expect(await screen.findByText('已接入 Example')).toBeVisible()
  expect(screen.getByRole('button', { name: '导入新信息' })).toBeVisible()
})
```

Also test “从现在开始”, invalid URL, duplicate source, loading state, retryable error, Escape close, and focus restoration.

- [ ] **Step 2: Run and verify failure**

Run: `npm test -- src/rss/RssSourceDrawer.test.tsx`

Expected: FAIL because the RSS connection UI is missing.

- [ ] **Step 3: Add API DTOs and client**

Define DTOs matching the server contract exactly. `rssApi` uses `/api/rss`, checks `response.ok`, parses structured errors, accepts an injectable `fetch`, and never returns `any`. `useRss` owns sources, items, loading, error, connect, refresh, pause, and resume state.

- [ ] **Step 4: Add the minimal drawer and preserve current entry points**

Add `RSS` to the existing import source choices. The drawer contains only URL, a collapsed “导入方式” choice defaulting to “最近 20 条”, an alternative “从现在开始”, the primary “接入” button, and one concise error line. Do not remove or repurpose “导入新信息” or global quick capture.

Proxy `/api` to `http://127.0.0.1:8787` in Vite development configuration.

- [ ] **Step 5: Run tests and commit**

Run: `npm test -- src/rss/RssSourceDrawer.test.tsx src/App.test.tsx`

Expected: new RSS tests and all existing demo interaction tests pass.

```bash
git add src/rss src/App.tsx vite.config.ts
git commit -m "feat: connect RSS sources from the existing import flow"
```

### Task 8: Display live RSS items and reuse the evidence viewer

**Files:**
- Create: `src/rss/RssItem.tsx`
- Create: `src/rss/RssItems.tsx`
- Test: `src/rss/RssItems.test.tsx`
- Modify: `src/App.tsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Write failing presentation tests**

Verify that the list shows only type, source, time, and title by default; the newest three baseline entries show “首次导入”; details remain collapsed; later entries show “新信息”; and “查看来源” opens the existing source viewer with the real item URL and captured time.

```ts
expect(screen.getByText('新信息')).toBeVisible()
expect(screen.getByText('Example Feed')).toBeVisible()
expect(screen.getByRole('heading', { name: 'A real update' })).toBeVisible()
expect(screen.queryByText('Long feed summary')).not.toBeInTheDocument()
```

- [ ] **Step 2: Run and verify failure**

Run: `npm test -- src/rss/RssItems.test.tsx`

Expected: FAIL because live item components do not exist.

- [ ] **Step 3: Implement concise live items**

Render server items ahead of demo-only signals without turning the page into a dashboard. A details toggle reveals the plain-text summary. “查看来源” maps server evidence to the existing `EvidenceDrawer`. Change `EvidenceDrawer` to accept an `EvidenceViewModel` containing `title`, `kind`, `preview`, `excerpt`, `locator`, and `url`; adapt both demo sources and RSS evidence to that type so there remains exactly one source viewer.

Add only the CSS required for alignment, loading skeleton, empty state, and narrow-screen behavior. Reuse existing paper, ink, spacing, and typography tokens; do not add card shadows, badges, or explanatory subtitles.

- [ ] **Step 4: Run focused and regression tests**

Run: `npm test -- src/rss/RssItems.test.tsx src/App.test.tsx`

Expected: RSS presentation tests and existing homepage/source-viewer tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/rss src/App.tsx src/styles.css
git commit -m "feat: show RSS updates with shared evidence viewing"
```

### Task 9: Add source health controls to unified settings

**Files:**
- Create: `src/rss/RssSourcesSettings.tsx`
- Test: `src/rss/RssSourcesSettings.test.tsx`
- Modify: `src/App.tsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Write failing settings tests**

Verify source name, last successful check, state, adaptive frequency, pause/resume, manual retry after failure, and collapsed technical details. Ensure no frequency controls appear on homepage items.

- [ ] **Step 2: Run and verify failure**

Run: `npm test -- src/rss/RssSourcesSettings.test.tsx`

Expected: FAIL because the settings component does not exist.

- [ ] **Step 3: Implement settings controls**

Show one compact row per RSS source. Healthy sources display the last success time; failures show a short human-readable state without treating them as “no update”. Put URL, ETag, Last-Modified, last error, and fetch history behind “详情”. Frequency choices are “自适应、尽快、每天、每周、仅手动”; pause is explicit and reversible.

- [ ] **Step 4: Run tests and commit**

Run: `npm test -- src/rss/RssSourcesSettings.test.tsx src/App.test.tsx`

Expected: settings and existing frequency tests pass.

```bash
git add src/rss/RssSourcesSettings.tsx src/rss/RssSourcesSettings.test.tsx src/App.tsx src/styles.css
git commit -m "feat: manage RSS health in unified settings"
```

### Task 10: Verify the complete local production slice

**Files:**
- Modify: `README.md`
- Create: `server/rss/rss-flow.test.ts`

- [ ] **Step 1: Add a full-flow integration test**

Start the Fastify app against the test database and a local fixture HTTP server. Inject a test-only resolver and URL policy that map `feed.test` to the fixture server; production code must never allow loopback. Connect a Feed with 22 entries, verify 20 stored and three displayed, change the fixture to add one item, manually run the source, verify exactly one new homepage item and evidence, then return HTTP 500 and verify the cursor and last successful state remain intact.

- [ ] **Step 2: Document exact local operation**

README must include prerequisites, environment setup, `docker compose up -d db`, migration, server and Web commands, baseline semantics, safe deployment boundary, backup location, and a warning that this phase has no application-level login and therefore must remain loopback-only or behind trusted deployment authentication.

- [ ] **Step 3: Run the full verification suite**

Run:

```bash
npm run lint
npm test
npm run build
docker compose up -d db
npm run db:migrate
TEST_DATABASE_URL=$DATABASE_URL npm test -- server/rss/rss-flow.test.ts
```

Expected: lint exits 0, all unit/component/integration tests pass, the production build exits 0, migrations are idempotent, and the full RSS flow passes.

- [ ] **Step 4: Perform manual acceptance**

Run `npm run server:dev` and `npm run dev`. In a browser:

1. Confirm existing “导入新信息” and global quick capture still work.
2. Connect a real public RSS Feed using “最近 20 条”.
3. Confirm at most three baseline items appear as “首次导入”.
4. Open a source and confirm its original URL works.
5. Confirm summary and technical details are collapsed.
6. Pause and resume the source in settings.
7. Stop the Feed server or use an invalid endpoint; confirm the failure appears only in settings and old items remain available.

- [ ] **Step 5: Commit documentation and acceptance test**

```bash
git add README.md server/rss/rss-flow.test.ts
git commit -m "test: verify end-to-end RSS ingestion"
```

## Completion criteria

The slice is complete only when a fresh checkout can start PostgreSQL, migrate, connect a real Feed, preserve the agreed baseline, discover a later item without duplication, show its evidence in the shared viewer, survive a failed fetch without advancing state, and pass the complete automated and manual acceptance sequence. Passing frontend tests alone is not completion.

# RSS AI Analysis Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add real OpenAI-compatible analysis for RSS items, explicit unconfigured status, and a one-command local startup path without redesigning the frontend.

**Architecture:** RSS persistence remains the reliable ingestion boundary. Each inserted or revised item receives a database-backed analysis job; a separate worker claims jobs and calls a narrow OpenAI-compatible analyzer, so model failures never roll back source content or evidence. Runtime configuration and API status expose model readiness without exposing the API key.

**Tech Stack:** TypeScript, Fastify, PostgreSQL, Zod, Vitest, native `fetch`, Docker Compose, npm/concurrently.

---

### Task 1: Parse safe AI runtime configuration

**Files:**
- Modify: `.env.example`
- Modify: `server/config.ts`
- Modify: `server/config.test.ts`

- [ ] **Step 1: Write failing configuration tests**

Add tests that expect a complete `ai` configuration from `AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL`, and the default `AI_TIMEOUT_MS`, plus `ai: null` when all three required values are absent. Add a partial-configuration test expecting a validation error.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test -- server/config.test.ts`

Expected: FAIL because `readConfig()` has no `ai` field.

- [ ] **Step 3: Implement minimal configuration parsing**

Return this shape without logging or serializing the key:

```ts
ai: value.AI_BASE_URL && value.AI_API_KEY && value.AI_MODEL ? {
  baseUrl: value.AI_BASE_URL,
  apiKey: value.AI_API_KEY,
  model: value.AI_MODEL,
  timeoutMs: value.AI_TIMEOUT_MS,
} : null
```

Reject partial configuration with a Zod refinement and document the four variables in `.env.example`.

- [ ] **Step 4: Verify GREEN**

Run: `npm test -- server/config.test.ts`

Expected: all configuration tests pass.

- [ ] **Step 5: Commit**

```bash
git add .env.example server/config.ts server/config.test.ts
git commit -m "feat: configure OpenAI-compatible analysis"
```

### Task 2: Build and validate the OpenAI-compatible analyzer

**Files:**
- Create: `server/ai/types.ts`
- Create: `server/ai/openai-compatible.ts`
- Create: `server/ai/openai-compatible.test.ts`

- [ ] **Step 1: Write failing analyzer tests**

Test a successful JSON response, fenced JSON normalization, timeout, HTTP 401 as `AI_AUTH_FAILED`, HTTP 429 as `AI_RATE_LIMITED`, server failure as `AI_UPSTREAM_FAILED`, and schema-invalid output as `INVALID_MODEL_OUTPUT`. Verify the Authorization header is sent but never included in thrown messages.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test -- server/ai/openai-compatible.test.ts`

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement the narrow analyzer**

Define `ContentAnalyzer`, `AnalysisInput`, `AnalysisResult`, and an `AiAnalysisError` carrying a safe code and retryability. Use `fetch` with `AbortController`, POST to `<baseUrl>/chat/completions`, request JSON output, and validate:

```ts
const resultSchema = z.object({
  summary: z.string().trim().min(1).max(120),
  relevance: z.enum(['high', 'medium', 'low', 'unknown']),
  reason: z.string().trim().max(80),
})
```

The system prompt must require compression only, no added recommendations, and `unknown` when no goal is supplied.

- [ ] **Step 4: Verify GREEN**

Run: `npm test -- server/ai/openai-compatible.test.ts`

Expected: all analyzer tests pass.

- [ ] **Step 5: Commit**

```bash
git add server/ai
git commit -m "feat: add OpenAI-compatible content analyzer"
```

### Task 3: Persist analysis jobs and results

**Files:**
- Create: `server/db/migrations/003_rss_item_analysis.sql`
- Create: `server/ai/repository.ts`
- Create: `server/ai/repository.test.ts`
- Modify: `server/rss/repository.ts`
- Modify: `server/db/schema.test.ts`

- [ ] **Step 1: Write failing schema and repository tests**

Cover one analysis row per RSS item, automatic job creation with an inserted item, `FOR UPDATE SKIP LOCKED` claiming, completed result persistence, retryable failure scheduling, terminal failure, and manual requeue. Use a unique test workspace and delete only its own sources.

- [ ] **Step 2: Run the focused database tests and verify RED**

Run: `TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/zhiliao_test npm test -- server/db/schema.test.ts server/ai/repository.test.ts`

Expected: FAIL because the analysis table and repository do not exist.

- [ ] **Step 3: Add the migration and minimal repository**

Create `rss_item_analysis` with status constraint, bounded result fields, attempt count, next attempt time, safe error fields, timestamps, and a unique `item_id` foreign key with cascade deletion. Make `RssRepository.insertItem()` create the analysis row in the same transaction; make item revisions requeue the existing analysis.

- [ ] **Step 4: Verify GREEN**

Run the same focused database command.

Expected: schema and repository tests pass.

- [ ] **Step 5: Commit**

```bash
git add server/db server/ai/repository.ts server/ai/repository.test.ts server/rss/repository.ts
git commit -m "feat: persist RSS analysis jobs"
```

### Task 4: Process analysis asynchronously with bounded retries

**Files:**
- Create: `server/ai/worker.ts`
- Create: `server/ai/worker.test.ts`
- Modify: `server/app.ts`
- Modify: `server/index.ts`

- [ ] **Step 1: Write failing worker tests**

Test that the worker claims pending jobs, completes valid results, retries a retryable failure no more than three times, terminally fails authentication errors, marks jobs `not_configured` without an analyzer, and never alters the RSS item or evidence.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test -- server/ai/worker.test.ts`

Expected: FAIL because the worker does not exist.

- [ ] **Step 3: Implement worker and runtime wiring**

Create a scheduler with `runOnce/start/stop`, a short unref'd interval, single-job atomic claims, and repository-driven retry timestamps. Construct the OpenAI-compatible analyzer only when `config.ai` is present. Start and stop the AI worker alongside the RSS scheduler in `buildApp()`.

- [ ] **Step 4: Verify GREEN**

Run: `npm test -- server/ai/worker.test.ts server/rss/scheduler.test.ts`

Expected: worker and existing scheduler tests pass.

- [ ] **Step 5: Commit**

```bash
git add server/ai/worker.ts server/ai/worker.test.ts server/app.ts server/index.ts
git commit -m "feat: process RSS analysis in background"
```

### Task 5: Expose explicit AI status and manual requeue APIs

**Files:**
- Create: `server/routes/ai.ts`
- Create: `server/routes/ai.test.ts`
- Modify: `server/routes/rss.ts`
- Modify: `server/routes/rss.test.ts`
- Modify: `server/rss/repository.ts`
- Modify: `server/app.ts`

- [ ] **Step 1: Write failing route tests**

Test `GET /api/ai/status` for `ready` and `not_configured`, `POST /api/rss/items/:id/analyze` returning 503 `AI_NOT_CONFIGURED` without configuration, successful 202 requeue, 404 for an unknown item, item detail returning analysis status/result, and `/health` including `ai` without becoming 503 when unconfigured.

- [ ] **Step 2: Run route tests and verify RED**

Run: `npm test -- server/routes/ai.test.ts server/routes/rss.test.ts`

Expected: FAIL because the routes and response fields do not exist.

- [ ] **Step 3: Implement routes and safe errors**

Register AI routes from `buildApp()`, add analysis to `getItemWithEvidence()`, and map `AI_NOT_CONFIGURED` to HTTP 503, missing item to 404, and accepted requeue to 202. Status responses may contain the model name but never base URL credentials or API keys.

- [ ] **Step 4: Verify GREEN**

Run the same focused route tests.

Expected: all route tests pass.

- [ ] **Step 5: Commit**

```bash
git add server/routes server/rss/repository.ts server/app.ts
git commit -m "feat: expose RSS AI analysis status"
```

### Task 6: Prove ingestion remains independent from AI

**Files:**
- Modify: `server/rss/rss-flow.test.ts`
- Modify: `server/rss/ingest.test.ts`

- [ ] **Step 1: Add failing end-to-end assertions**

Extend the database flow to assert that RSS connect returns before analysis, every stored item has a queued analysis state, evidence remains readable after a simulated model failure, and a later successful worker pass writes a validated summary.

- [ ] **Step 2: Run the focused flow and verify RED**

Run: `TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/zhiliao_test npm test -- server/rss/rss-flow.test.ts`

Expected: FAIL until the full ingestion-to-analysis integration is wired.

- [ ] **Step 3: Make the smallest integration corrections**

Adjust only transaction boundaries or dependency wiring needed for the flow; do not add synchronous model calls to RSS ingestion.

- [ ] **Step 4: Verify GREEN**

Run the focused flow again.

Expected: PASS with original evidence preserved.

- [ ] **Step 5: Commit**

```bash
git add server/rss/rss-flow.test.ts server/rss/ingest.test.ts server/rss/ingest.ts
git commit -m "test: verify asynchronous RSS analysis flow"
```

### Task 7: Add one-command local startup

**Files:**
- Create: `scripts/dev-setup.mjs`
- Create: `scripts/dev-setup.test.ts`
- Modify: `package.json`
- Modify: `README.md`

- [ ] **Step 1: Write failing command-construction tests**

Extract and test a small function that determines the Compose command, waits for the configured database URL, runs `npm run db:migrate`, and then launches `npm run dev:all`. Verify failure messages for missing Docker and database timeout.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test -- scripts/dev-setup.test.ts`

Expected: FAIL because the startup script does not exist.

- [ ] **Step 3: Implement the startup orchestrator**

Add `npm run dev:setup` calling `node scripts/dev-setup.mjs`. Use child processes without shell interpolation, preserve inherited output, wait for PostgreSQL using a bounded TCP check, run migrations once, then hand control to `npm run dev:all`. Forward termination signals to application children; leave the database container running.

- [ ] **Step 4: Verify GREEN and document usage**

Run: `npm test -- scripts/dev-setup.test.ts`

Expected: script tests pass. Update README with `cp .env.example .env`, the three required AI variables, `npm install`, and `npm run dev:setup`.

- [ ] **Step 5: Commit**

```bash
git add scripts package.json README.md
git commit -m "feat: add one-command local startup"
```

### Task 8: Final validation and real compatible-API smoke test

**Files:**
- Modify only if validation exposes a defect.

- [ ] **Step 1: Run static and automated validation**

```bash
npm run lint
TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/zhiliao_test npm test
npm run build
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/zhiliao npm run db:migrate
npm audit --omit=dev
git diff --check
```

Expected: all commands pass and audit reports zero vulnerabilities.

- [ ] **Step 2: Verify unconfigured runtime explicitly**

Start the server without AI variables. Verify `/health` reports `ai: not_configured`, `/api/ai/status` reports `not_configured`, and manual analyze returns HTTP 503 with `AI_NOT_CONFIGURED`.

- [ ] **Step 3: Verify configured runtime without spending the user's key**

Run a local OpenAI-compatible fixture server, configure `AI_BASE_URL` to it, ingest a fixture RSS item, run one worker cycle, and verify the item detail contains a completed summary and clickable evidence. Do not require or print a real API key in automated output.

- [ ] **Step 4: Record completion**

Confirm `git status --short` is empty and report the exact branch, test counts, runtime checks, and remaining scope boundary: no RAG, no web research, no frontend redesign.

# Knowledge Document Reader Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a low-noise reader for the two uploaded PDFs and make every homepage evidence/source entry flow into the same source viewer.

**Architecture:** Keep the prototype client-only. Represent document metadata, chapters, excerpts, related topics, and reading defaults as demo fixtures; render a dedicated document list and reader inside the existing knowledge route. Use one source-selection dialog for multi-source entries and the existing source viewer for every selected source.

**Tech Stack:** React, TypeScript, Vite, Vitest, Testing Library, CSS.

---

### Task 1: Document fixtures and reader navigation

**Files:**
- Modify: `src/domain/types.ts`
- Modify: `src/demo/demo-data.ts`
- Modify: `src/App.test.tsx`
- Modify: `src/App.tsx`
- Modify: `src/styles.css`

- [x] **Step 1: Write failing document-reader tests**

```tsx
it('opens uploaded knowledge documents in a focused reader', async () => {
  await user.click(screen.getByRole('button', { name: '知识库' }))
  await user.click(screen.getByRole('button', { name: '原始文档' }))
  expect(screen.getByText('深入理解 AI Agent：设计原理与工程实践')).toBeVisible()
  await user.click(screen.getByText('A Survey of Reinforcement Learning Techniques'))
  expect(screen.getByRole('heading', { name: '摘要' })).toBeVisible()
})
```

- [x] **Step 2: Verify the tests fail**

Run: `npm run test -- src/App.test.tsx`
Expected: FAIL because “原始文档” and the uploaded titles are absent.

- [x] **Step 3: Add minimal document types, fixtures, list, and reader**

Add `KnowledgeDocument` with `id`, `title`, `author`, `pageCount`, `kind`, `defaultSection`, `sections`, and `relatedTopicIds`. Add the 308-page Agent book and 20-page RL paper fixtures. Render a low-weight “原始文档” entry, document list, left directory, central excerpt, and optional related-topic aside.

- [x] **Step 4: Verify the reader tests pass**

Run: `npm run test -- src/App.test.tsx`
Expected: PASS.

### Task 2: Unified homepage source flow

**Files:**
- Modify: `src/App.test.tsx`
- Modify: `src/App.tsx`
- Modify: `src/styles.css`

- [x] **Step 1: Write failing source-flow tests**

```tsx
it('opens one shared viewer from homepage evidence and source collections', async () => {
  await user.click(screen.getByRole('button', { name: '查看证据：13:45 前完成组队确认' }))
  expect(screen.getByRole('dialog', { name: '来源' })).toBeVisible()
  await user.click(screen.getByRole('button', { name: '3 个来源' }))
  expect(screen.getByRole('dialog', { name: '选择来源' })).toBeVisible()
})
```

- [x] **Step 2: Verify the tests fail**

Run: `npm run test -- src/App.test.tsx`
Expected: FAIL because signal evidence is inline and the collection opens the first source directly.

- [x] **Step 3: Route both entry types through shared components**

Make single evidence buttons resolve a `Source` and open `EvidenceDrawer`. Add a compact `SourceListDialog` for multiple sources; selecting an item closes the list and opens that same `EvidenceDrawer`.

- [x] **Step 4: Verify all interactions and production build**

Run: `npm run test && npm run build && git diff --check`
Expected: all tests pass, Vite build succeeds, and no whitespace errors are reported.

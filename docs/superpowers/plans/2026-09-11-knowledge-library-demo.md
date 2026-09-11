# Knowledge Library Demo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the existing Zhilia single-page demo with action aggregation, completion archival, a low-noise knowledge library, clickable evidence, change history, relationship exploration, and centralized watch settings.

**Architecture:** Keep the demo as a client-only React application. Expand domain types so sources, facts, revisions, actions, and knowledge items remain separate; expose all demo state through one application shell with route-like views and drawers. Keep evidence navigation and assistant retrieval behind interfaces that can later be replaced by backend adapters.

**Tech Stack:** React, TypeScript, Vite, Vitest, Testing Library, CSS.

---

### Task 1: Domain model and demo fixtures

**Files:**
- Modify: `src/domain/types.ts`
- Create: `src/domain/knowledge.ts`
- Create: `src/domain/knowledge.test.ts`
- Modify: `src/demo/demo-data.ts`

- [x] Write failing tests proving related poster facts form one action, completion archives linked evidence, and knowledge saving includes referenced sources only.
- [x] Run `npm run test -- src/domain/knowledge.test.ts`; expect failures for missing knowledge functions.
- [x] Add `Fact`, `Revision`, `ActionAggregate`, `KnowledgeItem`, `WatchPreference`, and `EvidenceTarget` types plus pure grouping/archive/save functions.
- [x] Run the domain test and confirm all cases pass.

### Task 2: Action-first briefing and evidence viewer

**Files:**
- Modify: `src/App.test.tsx`
- Modify: `src/App.tsx`
- Modify: `src/styles.css`

- [x] Add failing interaction tests for a single “做海报” action card, expanded requirements, completion archival, and clickable source evidence.
- [x] Run `npm run test -- src/App.test.tsx`; expect the new assertions to fail.
- [x] Replace fact-per-card rendering with an action card that shows deadline, compact requirements, change count, source count, and an expandable detail region.
- [x] Implement an evidence drawer whose content varies for webpage, PDF, screenshot, and message targets and always displays the precise locator.
- [x] Implement complete action behavior that removes it from Now, archives cited evidence automatically, and confirms the result without a file picker.
- [x] Run the component test and confirm the action and evidence cases pass.

### Task 3: Knowledge library, history, relationships, and assistant

**Files:**
- Modify: `src/App.test.tsx`
- Modify: `src/App.tsx`
- Modify: `src/styles.css`

- [x] Add failing tests for saving related knowledge, opening the knowledge library, collapsed history, assistant answers with citations, and a local relationship view.
- [x] Run the component test and confirm the new assertions fail.
- [x] Add a quiet top-level navigation between “现在”和“知识库”; keep the result briefing as the default route.
- [x] Implement knowledge list and detail views with one summary, source count, categories, collapsed history, and related items.
- [x] Group knowledge topics under their primary category and keep source files inside topic detail views.
- [x] Reuse one source viewer for action requirements, knowledge details, history, and assistant citations.
- [x] Add an on-demand assistant panel with a fixed short demo response and clickable citations; do not persist responses.
- [x] Implement a limited one-hop relationship canvas rather than rendering a full graph dashboard.
- [x] Run the component test and confirm all knowledge interactions pass.

### Task 4: Centralized watch settings and final verification

**Files:**
- Modify: `src/App.test.tsx`
- Modify: `src/App.tsx`
- Modify: `src/styles.css`
- Modify: `README.md`

- [x] Add failing tests proving following uses adaptive mode immediately and frequency choices exist only in Settings.
- [x] Run the component test and confirm the settings assertions fail.
- [x] Add Settings as a single entry point with global adaptive mode, meaningful-change notifications, watched items, per-item override, and stop-following controls.
- [x] Ensure completing an action stops its temporary watch while saved knowledge remains intact.
- [x] Update the README with the demo paths, interactions, and future adapter boundaries.
- [x] Run `npm run test` and `npm run build`; expect zero failures and a successful production bundle.

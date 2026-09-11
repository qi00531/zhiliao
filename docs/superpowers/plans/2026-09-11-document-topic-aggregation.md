# Document Topic Aggregation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the document reader with reusable knowledge topics derived from the two uploaded PDFs.

**Architecture:** Keep PDFs as sources and expose only categorized knowledge topics. Each topic owns one concise summary and precise source references; all references open the shared source viewer.

**Tech Stack:** React, TypeScript, Vite, Vitest, Testing Library, CSS.

---

### Task 1: Replace document UI with topic aggregation

**Files:** `src/App.test.tsx`, `src/App.tsx`, `src/demo/demo-data.ts`, `src/domain/types.ts`, `src/styles.css`

- [x] Write a failing test proving the knowledge home has no “原始文档” entry and shows the document-derived themes.
- [x] Run `npm run test -- src/App.test.tsx` and confirm the new assertion fails.
- [x] Add six concise knowledge topics, remove document-list and reader state/components/styles, and keep PDF references in topic details.
- [x] Run `npm run test && npm run build && git diff --check`; expect zero failures.

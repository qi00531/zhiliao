# Global Quick Capture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a global, low-friction information capture flow without changing the existing detailed import drawer.

**Architecture:** Keep the existing import control and add a quiet floating trigger bound to Ctrl/Command+K. A focused dialog accepts text or URL input, inherits the current goal, provides simulated voice capture and local audio playback, and shows one simulated classification result after submission.

**Tech Stack:** React, TypeScript, Vitest, Testing Library, CSS.

---

### Task 1: Global capture interaction

**Files:** `src/App.test.tsx`, `src/App.tsx`, `src/styles.css`, `README.md`

- [x] Write failing tests proving the existing import remains, quick capture opens independently, the shortcut works, and simulated voice state is interactive.
- [x] Run `npm run test -- src/App.test.tsx` and confirm failure for the missing entry.
- [x] Implement the focused dialog, shortcut, simulated voice state, local audio picker/player, and concise result without modifying the import drawer.
- [x] Run `npm run test && npm run build && git diff --check` and confirm zero failures.

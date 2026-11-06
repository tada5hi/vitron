# Playwright Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Test real vanilla and Nuxt Electron apps in development and production.

**Architecture:** Playwright drives CLI-owned development windows via CDP and unpacked production apps via its Electron launcher. Copied temporary examples isolate edits, outputs and user data. Keep unit tests separate.

**Tech Stack:** Node 26, TypeScript, Playwright Test, installed Electron 38, Vite 7, Nuxt 4, electron-builder, Ubuntu/Xvfb CI.

**Spec:** `docs/superpowers/specs/2026-11-06-playwright-design.md` (approved by user).

## Global Constraints

- Root-only development dependency; preserve public runtime contracts.
- Both examples in development and built mode; no signed installers or publishing.
- Modify copies only; stop all descendants before fixture removal.
- Ubuntu is the initial CI platform; verify locally on macOS.

## Review Focus

- Startup failure must preserve process logs and clean descendants (exercise a deliberate failed assertion).
- Main rebuild must disconnect/reconnect to the replacement Electron window (vanilla development scenario).
- Preload rebuild must update actual IPC output (vanilla development scenario).
- Built app must report `app.isPackaged` and serve loopback content without Vite (both production scenarios).
- External Nuxt renderer and all debug ports must stop on teardown (observe port closure and processes after the suite).

### Task 1: Playwright harness and real application scenarios

**Files:** root `package.json`, `package-lock.json`, `.gitignore`; create `playwright.config.ts`, `packages/vitron/test/e2e/{fixtures,examples.spec}.ts`; adjust ESLint/TS inclusion if needed.

**Interfaces:** `npm run test:e2e` builds the library then invokes root Playwright configuration. One worker; root `playwright-report/` and `test-results/` artifacts. Test fixture exposes copied root plus development/production window startup and automatic teardown.

- [x] Add Playwright root dev dependency and config, separate from Vitest; use installed Electron, no browser download.
- [x] Write four example/mode tests asserting renderer content, vanilla IPC, development renderer edits, vanilla preload edits and main restart. Run them before harness completion to observe missing startup behavior.
- [x] Implement minimal fixture copying, dependency resolution, free ports, CDP readiness, bounded process execution and process-tree cleanup. Use actual built CLI with cwd set to copied root.
- [x] Implement fixture-only unpacked packaging config extending each example, using installed Electron dist and disabled signing/publishing; launch packaged executable and assert packaged state, loopback URL and real renderer content.
- [x] Run real Electron scenarios to passing; deliberately withhold an expected source change and confirm failure diagnostics/cleanup, then restore the passing expectation.

### Task 2: CI and contributor guidance (independent worker)

**Files:** `.github/workflows/main.yml`, `.agents/testing.md`, `AGENTS.md` if needed, root `README.md` only if useful.

**Interfaces:** consumes Task 1 command `npm run test:e2e` and artifact paths `playwright-report/`, `test-results/`.

- [x] Add Ubuntu E2E CI job using existing install action, system Electron dependencies, Xvfb, bounded job timeout and upload failure artifacts.
- [x] Document separate unit/E2E commands, local display requirement, installed Electron usage, covered modes and report locations.
- [x] Check YAML and guide lint; do not change release workflows or add browser matrices.

### Task 3: Verify and review

- [x] Run `npm test`, `npm run test:e2e`, `npm run lint` and relevant TypeScript checks in the worktree.
- [x] Request independent lifecycle/diff review; fix confirmed findings and repeat affected checks.
- [x] Mark plan progress, verify clean original checkout and report worktree location with exact validation and limits.

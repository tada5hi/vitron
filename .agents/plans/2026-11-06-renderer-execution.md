# Renderer Execution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reject failed renderer builds before moving output or continuing application packaging.

**Architecture:** Keep the existing renderer module split and add one private result checker in `build.ts`. This is the smallest first slice of candidate 2 (concentrating renderer execution knowledge). The repeated Nuxt/Next switches do not currently justify a new execution abstraction; development readiness and output movement remain at their existing seams.

**Tech Stack:** TypeScript, cross-spawn, Vite, Vitest, npm workspaces.

**Spec:** [Embedded proposed design](#design)

**Status:** Proposed; deferred, not authorized for implementation in this task. All design choices below are proposals, not user agreements. Based on HEAD `08e07a5`; reconcile with the development-session work before execution.

## Global Constraints

- Use Node.js 24.15+ on the 24.x line, or Node.js 26+ for contributor commands.
- Preserve the public Node engine `^20.19.0 || >=22.12.0`, Electron peer `>=20.x`, and electron-builder peer `>=22.x`.
- Preserve the root and `vitron/main`, `vitron/preload`, `vitron/renderer` CJS, ESM and declaration export targets.
- No new dependencies, framework upgrades, plugin registry, public options, or changes to custom-command parsing.
- Preserve `(options: Options) => string` for both renderer command callbacks and their current spawn argument/options shapes.

## Review Focus

- Missing executables must reject with the original spawn error, before output movement (Tasks 1 and 2).
- Nonzero or null exit status, including signal termination, must stop the command sequence (Task 2).
- Custom command strings containing spaces must remain single executable strings with no shell or tokenization added (Task 1).
- Nuxt 2, Nuxt 3, Next and plain Vite must retain their current command order, arguments and fallback behavior (Task 2).
- A failed renderer must prevent main/preload builds and electron-builder packaging (Task 2).

---

## Design

`buildRendererApp(config: Config): Promise<void>` currently ignores every `spawn.sync` result. Custom builds and detected Nuxt/Next builds move renderer output even after failure; Nuxt/Next also continue to the second command. `BuildCommand.handler` already rejects packaging failures, so renderer builds should follow the same error contract.

Propose a private `assertRendererBuildResult(result: SpawnSyncReturns<Buffer>, command: string): void` in `packages/vitron/src/apps/renderer/build.ts`: throw `result.error` unchanged when present; otherwise throw an Error with message `${command} exited with status ${result.status}.` whenever status is not zero. Check immediately after each synchronous spawn. Preserve custom `spawn.sync(command(config.get()))` exactly, evaluating the callback once. Keep framework execution options `{ cwd: rootPath, stdio: 'inherit', detached: false }`.

Retain Nuxt >=3 `nuxi build/generate`, Nuxt <3 `nuxt build/generate`, Next `next build` then `next export`, and plain Vite's production config/build path. Keep `moveAppRendererDirectory` after successful external builds only. Do not broaden framework support or silently change an unrecognized package-info branch. `ps.ts` keeps custom and framework development commands; `dev.ts` keeps readiness/restart/stop ownership; `move.ts` keeps its filesystem implementation. Their distinct responsibilities make a unified executor unnecessary for this defect. A shared command selector would need to encode custom one-string invocation, framework argument lists, two-command production sequences, Vite fallback, and output movement; its interface would currently expose nearly the same knowledge as the small switches it replaces. Further consolidation therefore requires renewed design review and separate implementation authorization, rather than being an automatic follow-on to these tasks. In particular, custom commands currently omit the framework cwd/stdio options; whether to align that behavior is an unresolved compatibility decision and is explicitly outside these tasks.

Scope reaches `build.ts`, renderer build tests, and CLI orchestration tests. Read-only compatibility review includes `ps.ts`, `dev.ts`, `move.ts`, `config/types.ts`, `cli/build.ts`, existing renderer-startup tests, and both example E2E suites. No product configuration, fixtures, documentation guides, exports or dependencies need changes.

### Task 1: Reject custom renderer build failure

**Files:**
- Modify: `packages/vitron/src/apps/renderer/build.ts`
- Create: `packages/vitron/test/unit/utils/renderer-build.spec.ts`

**Interfaces:**
- Consumes: `rendererBuildCommand?: (options: Options) => string` and `spawn.sync(command: string)`.
- Produces: unchanged `buildRendererApp(config: Config): Promise<void>`; private `assertRendererBuildResult(result: SpawnSyncReturns<Buffer>, command: string): void` for Task 2.

- [ ] **Step 1:** Mock cross-spawn, Vite and `moveAppRendererDirectory`. Add `rejects custom command launch errors before moving output`: callback returns `'custom tool --flag'`, sync returns `{ error, status: null }`; assert rejection identity is `error`, callback called once with `config.get()`, sync called with exactly that one string, and move/Vite are not called. Add success/status-1 cases, asserting move occurs once only on status 0 and status 1 rejects with `'custom tool --flag exited with status 1.'`.
- [ ] **Step 2:** Run `npm test --workspace=vitron -- test/unit/utils/renderer-build.spec.ts`; expect failure because errors/status are ignored.
- [ ] **Step 3:** Add the private checker and apply it to the custom branch without changing callback or spawn contracts.
- [ ] **Step 4:** Repeat the targeted command; expect PASS. Run `npm run lint`; expect exit 0.
- [ ] **Step 5:** Commit only the task files: `git add packages/vitron/src/apps/renderer/build.ts packages/vitron/test/unit/utils/renderer-build.spec.ts` and `git commit -m 'fix(renderer): reject custom build command failures'`.

### Task 2: Stop framework command sequences and packaging on failure

**Files:**
- Modify: `packages/vitron/src/apps/renderer/build.ts`
- Modify: `packages/vitron/test/unit/utils/renderer-build.spec.ts`
- Modify: `packages/vitron/test/unit/utils/build-command.spec.ts`

**Interfaces:**
- Consumes: Task 1's private checker; existing `buildRendererApp(config: Config): Promise<void>`.
- Produces: same renderer/CLI interfaces with renderer failure propagated before subsequent build phases.

- [ ] **Step 1:** Add table tests for Nuxt `2.17.0`, Nuxt `3.0.0` and Next using their current exact commands/arguments. For each, first-command failure must produce one spawn and no move; second-command failure must produce two spawns and no move; status 0 must preserve order/options and move once. Cover original `error` identity and `{ status: null, signal: 'SIGTERM' }` rejection. Assert absent framework calls Vite with the production renderer config and never spawns/moves. In `build-command.spec.ts`, make mocked `buildRendererApp` reject and assert main/preload builders and electron-builder are not called.
- [ ] **Step 2:** Run `npm test --workspace=vitron -- test/unit/utils/renderer-build.spec.ts test/unit/utils/build-command.spec.ts`; expect framework failure cases to fail before editing.
- [ ] **Step 3:** Apply the private checker immediately after each existing Nuxt/Next synchronous spawn. Keep exact command order and output movement; no CLI change should be necessary because its awaits already propagate rejection.
- [ ] **Step 4:** Run `npm test --workspace=vitron`, `npm run lint`, and `npm run test:e2e`; expect exit 0 for all on a supported desktop environment. Existing renderer startup tests and vanilla/Nuxt development/packaged E2E tests provide compatibility coverage. If desktop execution is unavailable, report that limitation explicitly rather than claiming E2E passed.
- [ ] **Step 5:** Commit the three task files with `git commit -m 'fix(renderer): stop framework builds after command failure'` after staging them explicitly.

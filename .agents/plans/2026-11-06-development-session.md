# Development Session Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give development startup, rebuild reactions and cleanup one owner, without leaking acquired resources on failure or cancellation.

**Architecture:** One internal `runDevelopmentSession` function owns the main/preload watch handles, renderer and Electron lifetime. The CLI translates arguments and termination signals; the session absorbs resource ordering, failure rollback and cleanup. Preserve Electron restart sequencing and the existing renderer adapters; make Electron launch failures observable.

**Tech Stack:** TypeScript, Vite/Rollup watch, Node AbortSignal, Electron, Vitest, Playwright, npm workspaces.

**Spec:** [Embedded design](#design)

**Status:** Approved for implementation; in progress. Based on `08e07a5`.

## Global Constraints

- Use Node.js 24.15+ on the 24.x line, or Node.js 26+ for contributor commands.
- Preserve the public Node engine `^20.19.0 || >=22.12.0`, Electron peer `>=20.x`, and electron-builder peer `>=22.x`.
- Preserve the root and `vitron/main`, `vitron/preload`, `vitron/renderer` CJS, ESM and declaration export targets.
- Add no dependencies, public options, generic process supervisor, process adapter registry or framework upgrades.
- Preserve startup order: main build, optional preload build, renderer readiness, then Electron start.
- Preserve serialized Electron restarts and shutdown cancellation in `core/electron/create.ts`.
- Preserve main rebuild -> restart running Electron; preload rebuild -> reload running renderer; suppress both once stopping begins.
- Initial compilation/startup failure or rejected restart/reload stops the session and propagates failure after cleanup. Later compilation errors keep watchers alive.
- User decision: closing Electron alone continues to leave development running for this refactor. Shutdown-on-Electron-exit is a separate follow-up.
- Work only in the managed worktree. Use Conventional Commits without AI attribution. Review stability/correctness independently before opening a PR.

## Review Focus

- Cancellation before first watch success or during a pending acquisition must close resources acquired later (Tasks 1-3).
- A first compilation error must reject startup, while a later syntax error must allow a subsequent successful rebuild (Task 1).
- Cancelled external HTTP readiness and late Vite-server creation must not leave a renderer running or block retry (Task 2).
- Repeated signals, pending rebuild reactions and cleanup rejection must not restart resources or prevent other cleanup (Task 3).
- CLI failures must exit nonzero and normal signal shutdown must finish without async work on Node's `exit` event (Task 3).

---

## Design

### Decisions and alternatives

The user selected a development-session owner, rather than isolated fixes scattered across the CLI. A generic supervisor would add an unnecessary interface; retain concrete watcher, renderer and Electron implementation. Use the platform's AbortSignal as the termination seam rather than inventing lifecycle events or adding dependency-injection options.

The user agreed to fail startup and release resources on initial compilation/startup failure. Ordinary compilation errors after startup keep watching. Rejected Electron restart or renderer reload is fatal: stop, finish cleanup and reject. Closing Electron alone preserves current behavior; record whole-session shutdown on Electron exit as a follow-up.

Proposed implementation choices below are the builder's calls, not additional user agreements. The existing Electron stop/restart sequencing remains authoritative; narrowly expose spawn failures instead of redesigning termination. No renderer framework-selection, custom-command parsing, build-policy consolidation or configuration-singleton work belongs in this implementation.

### Interfaces and ownership

`buildWithWatchHook(config: InlineConfig, watchHook: ViteWatchHook): ViteWatchBuild` returns ownership immediately, before first compilation. Define `ViteWatchBuild = { ready: Promise<void>, close: () => Promise<void> }` and widen `ViteWatchHook` to `() => void | Promise<void>`. `ready` resolves once the first compilation succeeds, rejects first-build or initialization failures, and is settled if closed while pending. `close()` is idempotent, waits for pending watcher acquisition and closes it; it also works for non-watch builds. Await successful rebuild reactions so their rejection is observed. Do not mistake a later compilation error for a new startup failure.

`createRenderer` retains its existing interface except `start(signal?: AbortSignal): Promise<void>`. Both direct stop and supplied cancellation cancel pending startup. Preserve successful-HTTP readiness, its 60,000 ms timeout, Vite reload and framework restart behavior. Track pending startup so a Vite server acquired after cancellation is closed before cleanup finishes. Cleanup must not await itself; start must settle before a stopped renderer can retry. Preserve existing termination policy rather than designing a new cross-platform process supervisor; any stronger process-tree claim requires a real regression check.

Add `runDevelopmentSession(config: Config, logger: Logger, signal: AbortSignal): Promise<void>` in `packages/vitron/src/apps/dev.ts`, imported directly by the CLI. It clears/prepares output, owns both watch handles and existing Electron/renderer adapters, and waits until cancellation or fatal lifecycle failure. Normal cancellation resolves only after cleanup; operational or cleanup failures reject. Latch stopping before cleanup, cancel pending renderer startup, promptly call Electron stop to cancel queued restarts, close both watchers, and attempt every cleanup even when one rejects. Preserve the originating operational failure; include cleanup failures without losing it. Track pending acquisition and in-flight lifecycle work so a late completion cannot resurrect resources. Fatal callbacks signal failure and return; they must not synchronously wait for closure of the watcher currently invoking them.

`DevCommand.handler` keeps root/port/environment handling. Install SIGINT/SIGTERM handlers before calling the session; translate either into one AbortController cancellation and remove both handlers in `finally`. Await the session, return naturally after normal shutdown, and let failures reach the existing CLI error handling. Remove the asynchronous `exit` handler and forced successful `process.exit(0)`. No new published interface is exposed. Make the existing internal Electron `start(): Promise<void>` resolve on child spawn and reject on a launch error; `restart(): Promise<void>` awaits replacement spawn. Preserve its shutdown serialization, five-second escalation and normal close semantics. Missing Electron must reach session rollback rather than only being logged.

Delete the shallow `apps/main/dev.ts` and `apps/preload/dev.ts` forwarding modules and their barrel exports once the session calls config builders plus the watch implementation directly. Production build functions and config builders remain untouched. Update the existing architecture/testing guides only for verified current invariants.

### Deferred behavior

A future change should end development when Electron exits, because a renderer and watchers alone are not useful to this user. It needs an explicit Electron exit notification and must distinguish expected closure during a serialized restart from terminal closure. This work preserves current behavior and makes no such distinction yet.

### Task 1: Retain watch ownership and propagate initial failures

**Files:**
- Modify: `packages/vitron/src/core/vite/build.ts`, `packages/vitron/src/core/vite/types.ts`
- Temporarily adapt: `packages/vitron/src/apps/main/dev.ts`, `packages/vitron/src/apps/preload/dev.ts`
- Create: `packages/vitron/test/unit/utils/vite-watch.spec.ts`

**Interfaces:**
- Consumes: Vite `build(InlineConfig)` and its watch result.
- Produces: `ViteWatchBuild`, the widened `ViteWatchHook`, and synchronous `buildWithWatchHook(config, watchHook): ViteWatchBuild` from the Design section.
- Existing forwarding functions temporarily await `handle.ready` and return the handle, preserving the old CLI's initial ordering until Task 3.

- [ ] **Step 1:** Add focused tests showing first build failure rejects readiness, close during delayed initialization closes the eventual watcher once, repeated close shares cleanup, and an async rebuild reaction is awaited. Use real Vite and temporary entry files for one initial-build/rebuild/error-recovery path; use narrowly scoped Vite stand-ins only for deterministic acquisition/close failures. Observe pending rejections and close test-owned handles in `finally`.
- [ ] **Step 2:** Run `npm test --workspace=vitron -- test/unit/utils/vite-watch.spec.ts`; confirm the missing ownership/error behavior fails before editing production code.
- [ ] **Step 3:** Implement the specified handle. Observe Vite initialization rejection and initial watcher error events; retain later compilation recovery. Adapt both forwarding callers without changing production configuration.
- [ ] **Step 4:** Run the targeted command, then `npm test`; expect no failing tests. Verify closing a real watcher ends its activity rather than merely satisfying a mock.
- [ ] **Step 5:** Stage only task files and commit `fix(vite): retain watch handles and propagate startup failures`.

### Task 2: Make renderer startup cancellable

**Files:**
- Modify: `packages/vitron/src/apps/renderer/dev.ts`
- Modify: `packages/vitron/test/unit/utils/renderer-startup.spec.ts`

**Interfaces:**
- Consumes: optional standard AbortSignal; existing Vite and spawned-renderer adapters.
- Produces: `start(signal?: AbortSignal): Promise<void>`; existing `stop`, `restart`, `reload`, `up` remain available. `stop` and start cancellation finish owned startup cleanup before resolving.

- [ ] **Step 1:** Add regressions for abort during external HTTP readiness, direct stop during that wait, stop while Vite creation is delayed, external child launch error, repeated stop, cancellation between external reload stop/start, and successful retry after cancellation. Preserve existing IPv4/IPv6 readiness and timeout-retry tests. Assert actual readiness/cleanup outcomes with a local HTTP fixture where practical; use a deferred Vite adapter only for late-acquisition ordering.
- [ ] **Step 2:** Run `npm test --workspace=vitron -- test/unit/utils/renderer-startup.spec.ts`; confirm cancellation/late-acquisition cases fail first.
- [ ] **Step 3:** Add the smallest pending-start/cancellation ownership needed. Keep timeout, framework commands, reload behavior and process termination policy intact. Observe external child launch errors as startup failures, and carry session cancellation through the stop/start gap of an external reload so it cannot resurrect after shutdown. Avoid circular waits between startup failure cleanup and stop.
- [ ] **Step 4:** Repeat targeted tests, then `npm test`; expect PASS, including existing Electron shutdown/port reuse tests.
- [ ] **Step 5:** Commit task files with `fix(renderer): cancel and clean up pending development startup`.

### Task 3: Move orchestration into the session and verify the CLI

**Files:**
- Create: `packages/vitron/src/apps/dev.ts`
- Modify: `packages/vitron/src/cli/dev.ts`, `packages/vitron/src/core/electron/create.ts`
- Modify: `packages/vitron/test/unit/utils/electron-lifecycle.spec.ts`
- Delete: `packages/vitron/src/apps/main/dev.ts`, `packages/vitron/src/apps/preload/dev.ts`
- Modify: `packages/vitron/src/apps/main/index.ts`, `packages/vitron/src/apps/preload/index.ts`
- Create: `packages/vitron/test/unit/utils/dev-session.spec.ts`
- Modify: `test/e2e/fixtures.ts`, `examples/vanilla/test/e2e/electron.spec.ts`, `examples/nuxt/test/e2e/electron.spec.ts`
- Update verified invariants: `.agents/architecture.md`, `.agents/testing.md`

**Interfaces:**
- Consumes: Tasks 1-2, unchanged `buildMainConfig`, `buildPreloadConfig`, and the concrete Electron/renderer adapters. Electron start becomes `() => Promise<void>` and restart awaits it; stop/up contracts stay unchanged.
- Produces: internal `runDevelopmentSession(config: Config, logger: Logger, signal: AbortSignal): Promise<void>` and a CLI that adapts termination signals before startup.
- Test fixture may add `stopDev(): Promise<void>` to its test-only Example shape: send SIGTERM to the CLI itself, require a zero exit before bounded fallback teardown, and verify its renderer port can be rebound. This must not claim graceful cleanup by force-killing the process group first.

- [ ] **Step 1:** Add session checks for startup order, optional preload, partial startup failure, cancellation before first readiness and during renderer acquisition, both rebuild reactions, shutdown suppressing pending reactions, rejected restart/reload, Electron initial/replacement spawn failure, and cleanup continuing after a close rejection. Use deterministic deferred operations to control races, retain real session/watch/renderer logic where possible, and mock GUI/OS seams only. Each check must name the missing lifetime behavior it catches.
- [ ] **Step 2:** Run `npm test --workspace=vitron -- test/unit/utils/dev-session.spec.ts`; confirm failures before implementing the session.
- [ ] **Step 3:** Implement the session, narrowly propagate Electron spawn errors, migrate CLI signal translation, and remove forwarding modules/exports. Add vanilla and Nuxt development E2E assertions for normal SIGTERM shutdown through the test fixture; require natural CLI exit and renderer-port release before fallback cleanup. Confirm invalid initial main compilation exits nonzero in a focused built-CLI subprocess regression without launching Electron.
- [ ] **Step 4:** Run `npm test`, `npm run lint`, and `npm run test:e2e`. Require all existing main restart, preload reload, both renderer updates and packaged example checks to pass. Report any unavailable desktop checks rather than claiming success. Update the existing guides and mark implemented plan steps only after verified results.
- [ ] **Step 5:** Commit the task files with `refactor(dev): own development resources in one session`.

## Completion

Run an independent whole-branch stability/correctness review, concentrating on pending acquisition, duplicate cancellation, callback rejection and cleanup ordering. Fix confirmed issues with regression checks, then review the fixes. Check the final diff and test evidence before creating a Conventional Commits PR. Include the two deferred plans and the shutdown-on-Electron-exit follow-up; implement neither deferred architecture candidate in this worktree.

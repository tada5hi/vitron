# Development Session Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give development startup, rebuild reactions and cleanup one owner, without leaking acquired resources on failure or cancellation.

**Architecture:** One internal `runDevelopmentSession` function owns the main/preload watch handles, renderer and Electron lifetime. The CLI translates arguments and termination signals; the session absorbs resource ordering, failure rollback and cleanup. Preserve Electron restart sequencing and the existing renderer adapters; make Electron launch failures observable.

**Tech Stack:** TypeScript, Vite/Rollup watch, Node AbortSignal, Electron, Vitest, Playwright, npm workspaces.

**Spec:** [Embedded design](#design)

**Status:** Implementation and independent audit complete through `48cee82` on `refactor/development-session`. Final verification passed 98 tests on Node 24.15 and Node 26, lint with five existing warnings, and four real macOS Electron E2E tests. PR publication and CI/review triage remain pending.

## Global Constraints

- Use Node.js 24.15+ on the 24.x line, or Node.js 26+ for contributor commands.
- User-approved update (2026-11-07): public Node engine becomes `^24.15.0 || >=26.0.0` and Electron peer becomes `>=35.x`; preserve electron-builder peer `>=22.x`.
- User-approved update (2026-11-07): publish root CLI/library and `vitron/main`, `vitron/preload`, `vitron/renderer` as ESM-only with declarations; preserve subpath names and output directories. Electron application output formats remain unchanged unless verified incompatibility requires a targeted migration.
- Retain Vite `^7.3.7` to preserve required initialization/cleanup error propagation; the optional Vite 8 upgrade is deferred until its upstream watcher error channels work. Upgrade routup to `6.1.0` and locter to `4.1.2`; remove obsolete `@routup/static` when migrating serving. Add no unrelated dependencies, public options, generic process supervisor, process adapter registry or framework upgrades.
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

- [x] **Step 1:** Add focused tests showing first build failure rejects readiness, close during delayed initialization closes the eventual watcher once, repeated close shares cleanup, and an async rebuild reaction is awaited. Use real Vite and temporary entry files for one initial-build/rebuild/error-recovery path; use narrowly scoped Vite stand-ins only for deterministic acquisition/close failures. Observe pending rejections and close test-owned handles in `finally`.
- [x] **Step 2:** Run `npm test --workspace=vitron -- test/unit/utils/vite-watch.spec.ts`; confirm the missing ownership/error behavior fails before editing production code.
- [x] **Step 3:** Implement the specified handle. Observe Vite initialization rejection and initial watcher error events; retain later compilation recovery. Adapt both forwarding callers without changing production configuration.
- [x] **Step 4:** Run the targeted command, then `npm test`; expect no failing tests. Verify closing a real watcher ends its activity rather than merely satisfying a mock.
- [x] **Step 5:** Stage only task files and commit `fix(vite): retain watch handles and propagate startup failures`.

### Task 2: Make renderer startup cancellable

**Files:**
- Modify: `packages/vitron/src/apps/renderer/dev.ts`
- Modify: `packages/vitron/test/unit/utils/renderer-startup.spec.ts`

**Interfaces:**
- Consumes: optional standard AbortSignal; existing Vite and spawned-renderer adapters.
- Produces: `start(signal?: AbortSignal): Promise<void>`; existing `stop`, `restart`, `reload`, `up` remain available. `stop` and start cancellation finish owned startup cleanup before resolving.

- [x] **Step 1:** Add regressions for abort during external HTTP readiness, direct stop during that wait, stop while Vite creation is delayed, external child launch error, repeated stop, cancellation between external reload stop/start, and successful retry after cancellation. Preserve existing IPv4/IPv6 readiness and timeout-retry tests. Assert actual readiness/cleanup outcomes with a local HTTP fixture where practical; use a deferred Vite adapter only for late-acquisition ordering.
- [x] **Step 2:** Run `npm test --workspace=vitron -- test/unit/utils/renderer-startup.spec.ts`; confirm cancellation/late-acquisition cases fail first.
- [x] **Step 3:** Add the smallest pending-start/cancellation ownership needed. Keep timeout, framework commands, reload behavior and process termination policy intact. Observe external child launch errors as startup failures, and carry session cancellation through the stop/start gap of an external reload so it cannot resurrect after shutdown. Avoid circular waits between startup failure cleanup and stop.
- [x] **Step 4:** Repeat targeted tests, then `npm test`; expect PASS, including existing Electron shutdown/port reuse tests.
- [x] **Step 5:** Commit task files with `fix(renderer): cancel and clean up pending development startup`.

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

- [x] **Step 1:** Add session checks for startup order, optional preload, partial startup failure, cancellation before first readiness and during renderer acquisition, both rebuild reactions, shutdown suppressing pending reactions, rejected restart/reload, Electron initial/replacement spawn failure, and cleanup continuing after a close rejection. Use deterministic deferred operations to control races, retain real session/watch/renderer logic where possible, and mock GUI/OS seams only. Each check must name the missing lifetime behavior it catches.
- [x] **Step 2:** Run `npm test --workspace=vitron -- test/unit/utils/dev-session.spec.ts`; confirm failures before implementing the session.
- [x] **Step 3:** Implement the session, narrowly propagate Electron spawn errors, migrate CLI signal translation, and remove forwarding modules/exports. Add vanilla and Nuxt development E2E assertions for normal SIGTERM shutdown through the test fixture; require natural CLI exit and renderer-port release before fallback cleanup. Confirm invalid initial main compilation exits nonzero in a focused built-CLI subprocess regression without launching Electron.
- [x] **Step 4:** Run `npm test`, `npm run lint`, and `npm run test:e2e`. Require all existing main restart, preload reload, both renderer updates and packaged example checks to pass. Report any unavailable desktop checks rather than claiming success. Update the existing guides and mark implemented plan steps only after verified results.
- [x] **Step 5:** Commit the task files with `refactor(dev): own development resources in one session`.

### Task 4: Upgrade packaged serving and runtime requirements

**Approved addition (2026-11-07):** Upgrade routup to `6.1.0`, remove the incompatible `@routup/static` 2 plugin, and use Node `^24.15.0 || >=26.0.0` with Electron `>=35.x`. Keep electron-builder `>=22.x`. Vite is retained at `^7.3.7` because the optional Vite 8 attempt does not preserve required initialization and cleanup error propagation. Task 5 applies the separately approved ESM-only export migration.

**Design:** Keep the concrete development-session owner and existing renderer adapters. Upgrade dependencies and adapt only actual incompatible APIs. Replace obsolete static plugin with routup's current Node adapter and file response API, keeping filesystem access rooted to the renderer directory. Preserve existing HTTP behavior: loopback-only ephemeral port, index HTML/assets/MIME/HEAD/missing-file behavior, shutdown/load-error propagation. Use Node filesystem streaming primitives and the installed library; no new server abstraction or process supervisor. Keep configuration/build architecture unchanged. A full Environment API migration is a separate follow-up; environments do not replace process ownership.

**Files:** `packages/vitron/package.json`, `package-lock.json`, `packages/vitron/src/exports/main/module.ts`, relevant existing serving tests; Vite config/watch/renderer code and regression tests only as needed for supported backend ownership; current README/guides for actual runtime/API changes. Public serve/options and exports stay stable.

**Interfaces:** Consumes Tasks1-3's owned watch handles, cancellable renderer and development session. Produces the same interfaces on Vite 7/Rollup and routup 6, with the approved runtime floors.

- [x] **Step 1:** Inspect actual APIs/callers and current static behavior; add regressions for filesystem confinement (encoded traversal, sibling-prefix escape, dotfiles/symlink escape as relevant to existing behavior), successful root/index/assets, MIME/HEAD, missing files and resource cleanup. Install requested versions, run existing plus new focused tests/build and capture expected API/behavior RED before adapting production code. Do not add no-op change-detector tests for version strings.
- [x] **Step 2:** Implement smallest compatible API migration. Preserve watch readiness, async reaction observation/serialization, compiler recovery, and shutdown after pending Vite acquisition/restart/listen. Verify the installed Rollup error channels and wait for every active compilation before native close. Keep real options-rejection and cleanup-hook regressions. Preserve validation at the file-serving trust boundary, streaming and error propagation.
- [x] **Step 3:** Verify focused tests, uncached full `npm test`, `npm run lint`, and real `npm run test:e2e`, including both packaged examples and both natural development shutdown/port-rebind gates. Verify installed versions and dependency tree without invalid peer bindings. Explain any Environment API use or decision to retain current APIs.
- [x] **Step 4:** Commit the upgrade with a Conventional Commit marked breaking for approved Node/Electron minimum changes, no attribution. Write full report with RED/GREEN evidence and remaining limits to task-4-report.md; independent task review follows before the final whole-branch audit.

### Task 5: Publish Vitron as ESM only and upgrade locter

**User-approved addition (2026-11-07):** The user permits making Vitron ESM-only alongside the approved dependency and Node 24+ updates. This supersedes the original requirement to retain CJS package artifacts; it does not request changing Electron application output formats or implementing deferred architecture plans.

**Additional user request:** Upgrade locter from 2.x to latest stable `4.1.2` (official npm verified), whose Node minimum is 22 and package exports are import-only. Include this upgrade here so no intermediate CJS CLI tries to require an import-only package. Inspect every locter load/loadSync/locateMany consumer and pin actual config-loading behavior with tests.

**Design:** Publish only ESM JavaScript and matching declarations for the root CLI and `vitron/main`, `vitron/preload`, `vitron/renderer`. Keep subpath names and four output directories. Keep `.mjs` filenames to avoid unrelated filename churn. Update package metadata/exports/bin/copied subpath metadata and tsdown configuration coherently; remove obsolete CJS artifact references. Use native `import.meta` paths and `createRequire(import.meta.url)` only where existing resolution truly needs require semantics. Do not add compatibility wrappers or dual output. Let supported Node/Electron loading semantics handle consumers; change app output only if a concrete Electron regression proves it necessary.

**Files:** `packages/vitron/package.json`, `package-lock.json`, `packages/vitron/tsdown.config.mts`, `packages/vitron/tsconfig.build.json`, `packages/vitron/assets/package.json`, `packages/vitron/src/constants.ts`, `packages/vitron/src/config/utils/build.ts`; other current locter consumers in config discovery/framework detection and app config builders as necessary; built CLI/export regression tests, `test/e2e/fixtures.ts`, current README/architecture/testing guides and affected example/config paths only when actually required.

**Interfaces:** Same CLI commands and library helper signatures, same root/main/preload/renderer package subpaths, ESM-only JavaScript/declarations. User-approved Node `^24.15.0 || >=26.0.0`, Electron `>=35.x`; electron-builder peer unchanged.

- [x] **Step 1:** Upgrade locter to `4.1.2` and capture real config/API failures before adapting callers. Verify JSON, CJS/ESM and TS config discovery/loading plus framework package detection using the actual supported loader. Inspect actual build/export/runtime callers and all hard-coded CJS paths. Add consumer-visible built-package regression checks: CLI help and invalid-main/SIGTERM cases use declared bin, ESM exports load, packaged artifact targets exist, and actual runtime paths/resolution used by init/config remain valid. Confirm expected RED from new ESM contract before production edits; avoid source-text/version-string assertions.
- [x] **Step 2:** Emit only ESM and declarations; update metadata/entry paths and native path/resolution seams. Ensure a clean build cannot accidentally pass through stale CJS files. Preserve Electron app main/preload behavior unless a confirmed format incompatibility requires a targeted adjustment. Simplify dynamic imports only when doing so preserves actual consumers and the chosen supported Electron runtime.
- [x] **Step 3:** Run clean package build, focused built-CLI/export regressions, uncached `npm test` on Node26 and minimum Node24.15, `npm run lint`, and actual `npm run test:e2e` including real dev shutdown and both packaged apps. Inspect `npm pack --dry-run` to confirm published targets and absence of CJS artifacts. Confirm dependency tree remains valid and all current docs match final behavior.
- [x] **Step 4:** Commit a breaking Conventional Commit without attribution, append exact TDD/test/E2E/export evidence and remaining limits to task-5-report.md. Independent task review and final whole-branch stability/correctness/security/concurrency/regression audit follow before push/PR/CI triage.

## Final audit resolution

Retain Vite `^7.3.7`: Vite 8 fails the required options-initialization and plugin-cleanup error channels. Both failures have real SDK regressions. Watcher closure also waits for every active compilation, including later asynchronous options hooks, before closing acquired resources. The current-cycle barrier settles before rebuild reactions and rechecks work started while awaiting. The final scoped review found no remaining Critical or Important issue.

Routup 6, locter 4, the Node/Electron floors and ESM-only Vitron exports remain. Full Environment API adoption, the other two architecture candidates and shutdown-on-Electron-exit remain separate work. The older deferred plans must reconcile the current runtime/export contracts before execution.

## Completion

Run an independent whole-branch stability/correctness review, concentrating on pending acquisition, duplicate cancellation, callback rejection and cleanup ordering. Fix confirmed issues with regression checks, then review the fixes. Check the final diff and test evidence before creating a Conventional Commits PR. Include the two deferred plans and the shutdown-on-Electron-exit follow-up; implement neither deferred architecture candidate in this worktree.

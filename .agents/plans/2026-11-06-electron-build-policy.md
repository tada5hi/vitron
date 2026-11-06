# Shared Electron Build Policy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Concentrate the common main/preload Vite build policy while preserving their distinct behavior.

**Architecture:** Add one internal Electron config factory beside the existing application utilities. Existing main/preload config builders remain the callers' interface and retain required/optional entry semantics, process-specific additions and customization hooks.

**Tech Stack:** TypeScript, Vite, locter, smob, Rollup replacement plugin, Vitest, npm workspaces.

**Spec:** [Embedded proposed design](#design)

**Status:** Proposed; deferred, not authorized for implementation in this task. All design choices below are proposals, not user agreements. Based on HEAD `08e07a5`; reconcile with the development-session work before execution.

## Global Constraints

- Use Node.js 24.15+ on the 24.x line, or Node.js 26+ for contributor commands.
- Preserve the public Node engine `^20.19.0 || >=22.12.0`, Electron peer `>=20.x`, and electron-builder peer `>=22.x`.
- Preserve the root and `vitron/main`, `vitron/preload`, `vitron/renderer` CJS, ESM and declaration export targets.
- No new dependencies, generic Vite framework, configurable flag matrix or changes to renderer configuration.
- Retain CJS `index` output, `es2020` targets, package dependency and peer externalization, Electron externalization, and bare/`node:` builtin externalization.

## Review Focus

- Packages with missing dependency/peer maps must still build; malformed manifests must still reject (Task 1).
- Missing main must throw while missing preload must remain optional, without hiding manifest failures (Task 2).
- Both bare and `node:` builtins, including subpaths, must remain external (Tasks 1 and 2).
- Main and preload must keep different cleaning behavior and only main receives defines/replacements (Task 2).
- Custom hooks must receive process-specific defaults and keep their existing smob precedence; successive config builds must not share mutable arrays/objects (Task 2).

---

## Design

`apps/main/config.ts` and `apps/preload/config.ts` currently repeat manifest loading, dependency/peer collection, entry lookup, path resolution, watch defaults, manifest generation, CJS library output, `es2020` targets and Electron/Node externalization. The same policy has two real callers, so sharing it increases locality without introducing a new public interface.

Propose `buildElectronConfig(config: Config, app: AppName.MAIN | AppName.PRELOAD): Promise<InlineConfig | undefined>` in `packages/vitron/src/apps/utils/electron-config.ts`, imported directly by the two builders rather than re-exported through public barrels. It loads `rootPath/package.json` before entry lookup, preserving error ordering even for absent preload; it uses the existing entry/path/dependency helpers. An absent entry returns undefined to its wrapper. Each invocation returns fresh config objects and external lists. Shared output contains `mode`, `root`, `optimizeDeps.esbuildOptions.target: 'es2020'`, `build.watch: {}`, `manifest: true`, `target: 'es2020'`, per-app `outDir`, CJS `index` library settings and Rollup input/externals.

`buildMainConfig(config: Config): Promise<InlineConfig>` converts undefined to the existing `'The main entrypoint file could not be located...'` error, adds `emptyOutDir: false`, `server: {}`, `NODE_ENV`/`PORT` defines and the existing replacement plugin (`uncrypto` to `crypto`, `process.env.NODE_ENV`, `process.env.PORT`, `preventAssignment: true`). It applies `merge(customConfig(inlineConfig), inlineConfig)` last, unchanged. `buildPreloadConfig(config: Config): Promise<InlineConfig | undefined>` keeps optional absence, adds `emptyOutDir: true`, and applies its own hook with the same merge expression. Neither wrapper adds policy flags to the factory.

The unchanged callers are `apps/main/{build,dev}.ts` and `apps/preload/{build,dev}.ts`: production clears the watch setting, development supplies existing watch hooks. No exports, example source, fixture formats, dependencies or runtime requirements change. Tests exercise the new internal factory and existing wrapper interfaces; existing packaged example E2E tests verify actual output compatibility.

### Task 1: Introduce the common policy factory

**Files:**
- Create: `packages/vitron/src/apps/utils/electron-config.ts`
- Create: `packages/vitron/test/unit/utils/electron-config.spec.ts`

**Interfaces:**
- Consumes: `Config`, `AppName.MAIN | AppName.PRELOAD`, existing `findEntryFile`, path helpers and dependency helpers.
- Produces: `buildElectronConfig(config: Config, app: AppName.MAIN | AppName.PRELOAD): Promise<InlineConfig | undefined>` for Task 2; direct internal import only.

- [ ] **Step 1:** Add temp-project tests with real `package.json` and `src/{main,preload}/index.ts` entries. For both apps assert root/outDir, `mode`, watch `{}`, manifest `true`, both `'es2020'` targets, library `{ entry, fileName: 'index', formats: ['cjs'] }`, Rollup input and externals containing declared dependency/peer keys, `electron`, `fs/promises` and `node:fs/promises`. Assert omitted dependency maps work, absent entry returns undefined, and invalid manifest rejects even when entry is missing. Clean only test-created temp directories.
- [ ] **Step 2:** Run `npm test --workspace=vitron -- test/unit/utils/electron-config.spec.ts`; expect failure because the module does not exist.
- [ ] **Step 3:** Implement the proposed factory by moving shared policy, using current helpers and preserving manifest-before-entry ordering. Keep process-only settings out; create fresh nested values on every call.
- [ ] **Step 4:** Repeat the targeted command and run `npm run lint`; expect exit 0.
- [ ] **Step 5:** Stage only the two task files and commit with `git commit -m 'refactor(apps): centralize Electron build defaults'`.

### Task 2: Route existing builders through the shared policy

**Files:**
- Modify: `packages/vitron/src/apps/main/config.ts`
- Modify: `packages/vitron/src/apps/preload/config.ts`
- Modify: `packages/vitron/test/unit/utils/electron-config.spec.ts`

**Interfaces:**
- Consumes: Task 1's `buildElectronConfig(config, app)`.
- Produces: unchanged `buildMainConfig(config: Config): Promise<InlineConfig>` and `buildPreloadConfig(config: Config): Promise<InlineConfig | undefined>`; no caller changes.

- [ ] **Step 1:** Add wrapper cases for missing required main versus optional preload; main `emptyOutDir: false` versus preload `true`; main-only `server`, defines and replacement plugin; hook inputs and existing `merge(custom, defaults)` precedence using overridden `build.target` plus an untouched default. Assert replacement plugin options exactly match existing values using a plugin mock. Confirm factory consumption through diff review; do not assert on internal call structure. Add a sequential-build test where the first hook mutates externals and the next build has no leaked value.
- [ ] **Step 2:** Run `npm test --workspace=vitron -- test/unit/utils/electron-config.spec.ts`; expect compatibility assertions to pass against the old wrappers, establishing the behavior-preserving refactor baseline. Do not manufacture a failing structural test.
- [ ] **Step 3:** Replace duplicated policy with factory calls, preserving each wrapper's distinct additions and hook order. Remove only imports and logic made redundant; keep the factory absent from export barrels.
- [ ] **Step 4:** Run `npm test --workspace=vitron`, `npm run build --workspace=vitron`, `npm run lint`, and `npm run test:e2e`; expect exit 0 on a supported desktop environment. The vanilla and Nuxt packaged E2E flows exercise real CJS bundles, preload integration and externalization. Report unavailable desktop/Electron packaging checks explicitly.
- [ ] **Step 5:** Stage the three task files and commit with `git commit -m 'refactor(apps): share main and preload build policy'`.

# Structure and architecture

`packages/vitron` owns the CLI and public library. `examples/vanilla`, `examples/nuxt` and `examples/next` are private consumers that build real desktop packages. `packages/vitron/assets/templates/` supplies the scaffolded application source.

README visuals live in `.github/assets/`. Published package README images use immutable commit URLs so each version keeps its matching diagrams.

| Source | Responsibility |
| --- | --- |
| `src/cli/` | `init`, `dev` and `build` command orchestration |
| `src/config/` | Project configuration and framework detection |
| `src/apps/dev.ts` | Own development startup, rebuild reactions and resource cleanup |
| `src/apps/{main,preload,renderer}/` | Per-process Vite configuration, builds and the renderer development adapter |
| `src/core/` | Electron child-process handling and Vite watch hooks |
| `src/exports/main/` | Load a development URL or serve packaged renderer files |
| `src/exports/preload/` | Expose an explicit value through Electron's context bridge |
| `src/exports/renderer/` | Retrieve a value exposed by the preload |

The package publishes the root CLI/library and `vitron/main`, `vitron/preload`, `vitron/renderer` subpaths. Preserve their ESM JavaScript and declaration export targets. Build and release caches must retain all four output directories: `dist`, `main`, `preload` and `renderer`.

`runDevelopmentSession` owns `vitron dev`. It starts the main build, optional preload build, renderer readiness and Electron in order; its state is one abort controller linked to the CLI's signal and a stack of cleanups. SIGINT/SIGTERM cancel startup and the running session and allow a natural exit. A startup failure or rejected restart/reload aborts with that error. Cleanup runs in reverse order, stops Electron first, attempts every step and rejects with the original failure. Main rebuilds restart running Electron after the previous process closes; preload rebuilds reload a ready renderer; neither reaction runs after an abort. Later compilation errors keep watching. When a spawned Electron process exits without a stop or restart request, the session ends: exit code 0 resolves it, any other code or a signal rejects it, and cleanup runs as for an abort. A closed window with the app still alive does not end it.

On abort the built-in Vite renderer calls the public `server.close()` synchronously, which removes Vite's SIGTERM callback before it can call `process.exit()`. The CLI registers its signal handlers before the session starts, so the abort lands first.

The Nuxt example's Electron main process has a TypeScript config independent of Nuxt-generated renderer state. Main/preload builds externalize Electron and Node builtins, including `node:` names. Renderer builds have their own framework configuration. Changes to shared configuration must work with both examples.

`serve()` uses the supplied port in development. In a packaged app it binds a loopback-only HTTP server to an OS-assigned port, loads its actual address, rejects startup/load failures and closes the server and its open connections with its window. Files come from `@routup/assets` on routup; the handler scans the directory at startup and serves only what it found. Vitron adds no path, range or header logic. Do not expose this local file server on external interfaces.

The vanilla example exposes a narrow `ping()` preload API and registers its main-process handler before loading the renderer. Do not pass the entire `ipcRenderer` object through the bridge. Example product names must be plain desktop names, independent of scoped npm names, so macOS helper lookup resolves correctly.

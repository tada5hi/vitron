# Structure and architecture

`packages/vitron` owns the CLI and public library. `examples/vanilla` and `examples/nuxt` are private consumers that build real desktop packages. `packages/vitron/assets/templates/` supplies the scaffolded application source.

README visuals live in `.github/assets/`. Published package README images use immutable commit URLs so each version keeps its matching diagrams.

| Source | Responsibility |
| --- | --- |
| `src/cli/` | `init`, `dev` and `build` command orchestration |
| `src/config/` | Project configuration and framework detection |
| `src/apps/dev.ts` | Own development startup, rebuild reactions and resource cleanup |
| `src/apps/{main,preload,renderer}/` | Per-process Vite configuration, builds and renderer development adapter |
| `src/core/` | Electron child-process handling and Vite watch hooks |
| `src/exports/main/` | Load a development URL or serve packaged renderer files |
| `src/exports/preload/` | Expose an explicit value through Electron's context bridge |
| `src/exports/renderer/` | Retrieve a value exposed by the preload |

The package publishes the root CLI/library and `vitron/main`, `vitron/preload`, `vitron/renderer` subpaths. Preserve their ESM JavaScript and declaration export targets. Build and release caches must retain all four output directories: `dist`, `main`, `preload` and `renderer`.

Development starts the main build, optional preload build, renderer readiness and Electron in order. One session owns both watchers and adapters; SIGINT/SIGTERM cancel pending startup, await rebuild reactions and attempt every cleanup. Main rebuilds restart running Electron after its previous process closes; preload rebuilds reload a ready renderer. Shutdown suppresses both reactions and cancels pending restarts. Initial startup or lifecycle-operation failure rejects after cleanup, while later compilation errors keep watching. Watcher shutdown waits for the active Rollup compilation to complete or fail, including asynchronous options and bundle-finalization hooks, before closing acquired resources. Readiness and rebuild reactions wait for bundle finalization; its failures follow the initial-versus-later compilation error policy. Closing Electron alone leaves development running.

The embedded Vite renderer closes synchronously on session cancellation through its server hook, before Vite can force process exit. Renderer cleanup waits for pending startup, configuration hooks, started post-hooks and Vite config-restart acquisition/listen work, retaining restart failures. It releases any HTTP listener that bound after cancellation; one configuration failure cannot release cleanup while another started hook still acquires resources.

The Nuxt example's Electron main process has a TypeScript config independent of Nuxt-generated renderer state. Main/preload builds externalize Electron and Node builtins, including `node:` names. Renderer builds have their own framework configuration. Changes to shared configuration must work with both examples.

`serve()` uses the supplied port in development. In a packaged app it binds a loopback-only HTTP server to an OS-assigned port, loads its actual address, rejects startup/load failures and closes the server and active transfers with its window. File responses stream from canonical paths confined to the renderer directory; hidden path segments are blocked except the root `.well-known` directory, and symlinks escaping the renderer directory are not served. Do not expose this local file server on external interfaces.

The vanilla example exposes a narrow `ping()` preload API and registers its main-process handler before loading the renderer. Do not pass the entire `ipcRenderer` object through the bridge. Example product names must be plain desktop names, independent of scoped npm names, so macOS helper lookup resolves correctly.

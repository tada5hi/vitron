# Structure and architecture

`packages/vitron` owns the CLI and public library. `examples/vanilla` and `examples/nuxt` are private consumers that build real desktop packages. `packages/vitron/assets/templates/` supplies the scaffolded application source.

README visuals live in `.github/assets/`. Published package README images use immutable commit URLs so each version keeps its matching diagrams.

| Source | Responsibility |
| --- | --- |
| `src/cli/` | `init`, `dev` and `build` command orchestration |
| `src/config/` | Project configuration and framework detection |
| `src/apps/{main,preload,renderer}/` | Per-process Vite configuration and build/development lifecycle |
| `src/core/` | Electron child-process handling and Vite watch hooks |
| `src/exports/main/` | Load a development URL or serve packaged renderer files |
| `src/exports/preload/` | Expose an explicit value through Electron's context bridge |
| `src/exports/renderer/` | Retrieve a value exposed by the preload |

The package publishes the root CLI/library and `vitron/main`, `vitron/preload`, `vitron/renderer` subpaths. Preserve their CJS, ESM and declaration export targets. Build and release caches must retain all four output directories: `dist`, `main`, `preload` and `renderer`.

The Nuxt example's Electron main process has a TypeScript config independent of Nuxt-generated renderer state. Main/preload builds externalize Electron and Node builtins, including `node:` names. Renderer builds have their own framework configuration. Changes to shared configuration must work with both examples.

`serve()` uses the supplied port in development. In a packaged app it binds a loopback-only HTTP server to an OS-assigned port, loads its actual address, rejects startup/load failures and closes the server with its window. Do not expose this local file server on external interfaces.

The vanilla example exposes a narrow `ping()` preload API and registers its main-process handler before loading the renderer. Do not pass the entire `ipcRenderer` object through the bridge. Example product names must be plain desktop names, independent of scoped npm names, so macOS helper lookup resolves correctly.

<p align="center"><img src="https://raw.githubusercontent.com/tada5hi/vitron/85a376f1a861881bc88455a386f7defef5ff7588/.github/assets/logo.svg" width="144" height="144" alt="Vitron: a desktop window connecting its renderer and host panes"></p>
<h1 align="center">Vitron</h1>
<p align="center"><strong>This is a library to build beautiful (win, linux, mac) desktop apps for modern web projects with vite and electron.</strong></p>
<p align="center">One CLI for renderer development, Electron watch builds and desktop packaging.</p>
<p align="center">
  <a href="https://www.npmjs.com/package/vitron"><img src="https://img.shields.io/npm/v/vitron" alt="vitron npm version"></a>
  <a href="https://github.com/tada5hi/vitron/actions/workflows/main.yml"><img src="https://github.com/tada5hi/vitron/actions/workflows/main.yml/badge.svg" alt="Continuous integration"></a>
  <a href="https://github.com/tada5hi/vitron/blob/master/LICENSE"><img src="https://img.shields.io/github/license/tada5hi/vitron" alt="MIT license"></a>
</p>
<p align="center"><a href="#why-vitron">Why Vitron?</a> · <a href="#installation">Installation</a> · <a href="#usage">Usage</a> · <a href="#runtime-helpers">Runtime helpers</a> · <a href="#configuration">Configuration</a></p>

---

## Why Vitron?

Keep the three Electron application processes in one development workflow while choosing your own renderer.

| Concern | Without Vitron | With Vitron |
| --- | --- | --- |
| Main-process editing | Rebuild and restart Electron manually | The main watch build restarts Electron |
| Renderer changes | Manage the renderer process separately | `vitron dev` starts and stops the renderer with Electron |
| Renderer URLs | Branch between development and packaged loading yourself | `serve()` handles the two loading paths |
| Desktop output | Coordinate builds and electron-builder | `vitron build` builds all three parts, then invokes the packager |

<p align="center"><img src="https://raw.githubusercontent.com/tada5hi/vitron/85a376f1a861881bc88455a386f7defef5ff7588/.github/assets/renderer-flow.svg" width="960" alt="The Electron main process calls serve. In development it loads localhost at the supplied port; packaged apps serve renderer files on an OS-assigned loopback port. Both paths load the BrowserWindow, and the packaged server closes with its window."></p>

Development uses the supplied port, defaulting to `9000`. Packaged loading uses a loopback-only HTTP server on an OS-assigned port, serves the renderer directory, and closes the server with its window.

## Installation

```sh
npm install vitron
npm install --save-dev electron electron-builder
```

The published Node.js requirement is `^20.19.0 || >=22.12.0`. Peer requirements are Electron `>=20.x` and electron-builder `>=22.x`; your selected versions can impose additional Node requirements. The runtime helpers provide CommonJS and ES module exports with TypeScript declarations.

## Setup

Inside a new project directory:

```sh
npx vitron init
npm install
```

`init` creates missing scaffold files and keeps readable existing files. The scaffold includes `src/main`, `src/preload`, `src/renderer`, `package.json`, `vitron.config.js` and `electron-builder.yml`.

Keep your main, preload and renderer responsibilities separate. The [vanilla example](https://github.com/tada5hi/vitron/tree/master/examples/vanilla) shows a complete lifecycle and a narrow IPC bridge; the [Nuxt example](https://github.com/tada5hi/vitron/tree/master/examples/nuxt) supplies a framework renderer.

## Usage

The scaffold supplies these scripts:

```json
{
  "scripts": {
    "dev": "vitron dev",
    "build": "vitron build"
  }
}
```

Run `npm run dev` during development and `npm run build` for desktop output. The build runs the renderer, main and optional preload builds, then electron-builder; a packager failure rejects the build.

| Command option | Applies to | Default | Purpose |
| --- | --- | --- | --- |
| `--root`, `-r` | `init`, `dev`, `build` | Current directory | Project root |
| `--port`, `-p` | `dev` | Configured port (`9000`) | Renderer development port |
| `--config`, `-c` | `build` | `electron-builder.yml` | electron-builder configuration filename |
| `--flags`, `-f` | `build` | Empty array | Packager flags: `all`, `mac`, `win`, `linux`, `ia32`, `x64`, `armv7l`, `arm64` |

## Runtime helpers

### Main process

Call `serve()` after Electron is ready, using your `BrowserWindow`. Handle its rejection and destroy an unsuccessful window, as in the complete examples.

```ts
import path from 'node:path';
import type { BrowserWindow } from 'electron';
import { serve } from 'vitron/main';

export async function loadRenderer(window: BrowserWindow) {
    await serve(window, {
        directory: path.join(__dirname, '../renderer'),
        port: process.env.PORT,
    });
}
```

Vitron builds the main process as CommonJS. The directory above is relative to the compiled main entry. `directory` chooses the packaged files; `port` is used only in development. `serve()` rejects when server startup or window loading fails.

### Preload

Expose a small application API rather than Electron's entire IPC object:

```ts
import { ipcRenderer } from 'electron';
import { provide } from 'vitron/preload';

provide('desktop', {
    ping: (): Promise<string> => ipcRenderer.invoke('ping'),
});
```

Your main process must register the matching `ipcMain.handle('ping', ...)` handler before loading the renderer. `provide()` uses Electron's context bridge when context isolation is enabled and assigns the value to `window` otherwise.

### Renderer

```ts
import { inject } from 'vitron/renderer';

const desktop = inject<{ ping: () => Promise<string> }>('desktop');

desktop.ping().then((message) => {
    document.body.textContent = message;
});
```

`inject()` returns the exposed value and throws when its key is missing. Its generic is a TypeScript assertion of your API contract, not runtime validation.

| Export | Kind | Purpose |
| --- | --- | --- |
| `serve` from `vitron/main` | Function | Load a development URL or serve packaged renderer files; returns `Promise<void>` |
| `ServeOptions` from `vitron/main` | Type | Optional `directory` and development `port` |
| `provide` from `vitron/preload` | Function | Expose a value under an application-defined key |
| `inject` from `vitron/renderer` | Generic function | Retrieve the exposed value or throw when absent |

The package root is the command-line entry; use the subpaths above for runtime helpers.

## Configuration

Vitron loads `vitron.config.{ts,cts,mts,cjs,mjs,js,json}` files through locter. A CommonJS configuration can change the source layout:

```js
module.exports = {
    mainDirectory: 'src/main',
    preloadDirectory: 'src/preload',
    rendererDirectory: 'src/renderer',
};
```

| Option | Default | Purpose |
| --- | --- | --- |
| `port` | `9000` | Renderer development port |
| `rootPath` | Current directory | Base path for application files |
| `buildDirectory` | `.vitron` | Generated application files |
| `mainDirectory` | `src/main` | Main entry directory |
| `preloadDirectory` | `src/preload` | Optional preload entry directory |
| `rendererDirectory` | `src/renderer` | Renderer source directory |
| `rendererBuildDirectory` | `dist` | Framework renderer output copied into the application build |
| `mainConfig`, `preloadConfig`, `rendererConfig` | Unset | Functions customizing the respective Vite configuration |
| `rendererBuildCommand`, `rendererDevCommand` | Unset | Functions producing custom renderer commands |
| `framework` | Detected from project dependencies | Framework package information or package name |

## Notes

- **Static desktop renderer.** Packaged loading serves files; it does not start a framework SSR server.
- **Framework versions matter.** Nuxt and Next are detected from the project's package manifest. The built-in Next build path calls `next export`, which [Next.js removed in version 14](https://nextjs.org/docs/14/app/building-your-application/deploying/static-exports#version-history); current Next versions need an adapted renderer build configuration.
- **Packaging stays yours.** Configure application identity, targets and signing in electron-builder. The repository examples derive `electronVersion` from the installed Electron package so hoisted workspaces package the correct runtime.
- **Process boundaries stay explicit.** Expose application-specific preload functions and register their main-process handlers before window loading.

## License

Made with 💚

Published under the [MIT License](https://github.com/tada5hi/vitron/blob/master/LICENSE).

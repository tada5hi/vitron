<p align="center"><img src=".github/assets/logo.svg" width="144" height="144" alt="Vitron: a desktop window connecting its renderer and host panes"></p>
<h1 align="center">Vitron</h1>
<p align="center">Build Windows, Linux and macOS desktop apps with Vite and Electron. Develop your renderer with Vite, watch Electron's main and preload code, and package your app with electron-builder.</p>
<p align="center">
  <a href="https://www.npmjs.com/package/vitron"><img src="https://img.shields.io/npm/v/vitron" alt="vitron npm version"></a>
  <a href="https://github.com/tada5hi/vitron/actions/workflows/main.yml"><img src="https://github.com/tada5hi/vitron/actions/workflows/main.yml/badge.svg" alt="Continuous integration"></a>
  <a href="LICENSE"><img src="https://img.shields.io/github/license/tada5hi/vitron" alt="MIT license"></a>
</p>
<p align="center"><a href="#quick-start">Quick start</a> · <a href="#examples">Examples</a> · <a href="#connect-your-renderer-to-electron">Preload bridge</a> · <a href="#dig-deeper">Dig deeper</a> · <a href="#development">Development</a></p>

---

## Why Vitron?

An Electron application has more than a renderer to build. Vitron connects the main, preload and renderer development cycles and hands the resulting application to electron-builder.

| Concern | Without Vitron | With Vitron |
| --- | --- | --- |
| Main-process changes | Rebuild and restart Electron yourself | A Vite watch build restarts the running Electron process |
| Renderer development | Connect a renderer server to your desktop window | `vitron dev` starts the renderer and Electron together |
| Production loading | Start a file server and manage its lifetime | `serve()` loads packaged files through a loopback server tied to the window |
| Packaging | Run each process build, then the packager | `vitron build` builds the renderer, main and preload before electron-builder |

<p align="center"><img src=".github/assets/renderer-flow.svg" width="960" alt="The Electron main process calls serve. In development it loads localhost at the supplied port; packaged apps serve renderer files on an OS-assigned loopback port. Both paths load the BrowserWindow, and the packaged server closes with its window."></p>

The same `serve()` call loads your renderer in development and in the packaged app. You keep your UI in the renderer, desktop operations in the main process, and the API between them in the preload script.

## Quick start

Create a desktop app from the included template:

```sh
mkdir my-desktop-app
cd my-desktop-app
npx vitron@latest init
npm install
npm run dev
```

This opens an Electron window with a Vite renderer. Edit `src/renderer/main.ts` to change the page; edit `src/main/index.ts` to change the window. Vitron updates the renderer during development and restarts Electron when the main process changes.

The generated project separates the three parts of your application:

```text
src/
├── main/index.ts       # Create windows and handle desktop operations
├── preload/index.ts    # Expose your application API to the renderer
└── renderer/
    ├── index.html     # The page inside the window
    └── main.ts        # Your UI code
vitron.config.js       # Vitron development and build settings
electron-builder.yml   # App identity and desktop packaging
```

Run `npm run build` to build and package the app. Set your app name, application ID and packaging targets in `electron-builder.yml` before distributing it. See the [installation requirements](packages/vitron/README.md#installation) for supported Node.js versions and Electron peers.

## Examples

Start with vanilla to see the Electron pieces together, or choose Nuxt to explore a framework renderer. Both are complete applications you can run, change and package.

| Example | What you will learn | Source |
| --- | --- | --- |
| [Vanilla](#vanilla) | Create a window, load a Vite page, and call Electron through a preload API | [examples/vanilla](examples/vanilla/) |
| [Nuxt](#nuxt) | Run a Nuxt renderer inside Electron and package its generated static pages | [examples/nuxt](examples/nuxt/) |

Use Node.js 24.15+ on the 24.x line, or Node.js 26+, for the repository examples. Clone the repository and build the local Vitron package once:

```sh
git clone https://github.com/tada5hi/vitron.git
cd vitron
npm ci
npm run build --workspace=vitron
```

Run the commands below from this repository root. Stop one development command with Ctrl+C before starting the other example.

### Vanilla

```sh
npm run dev --workspace=examples/vanilla
```

The window displays `Vitron is running. IPC response: pong`. That message makes a complete round trip: the renderer calls `ping()`, the preload forwards it to Electron, and the main process replies with `pong`.

Follow the call through the [renderer](examples/vanilla/src/renderer/main.ts), [preload](examples/vanilla/src/preload/index.ts) and [main process](examples/vanilla/src/main/index.ts). The main process also shows window creation, load error handling and reopening the window on macOS.

To build the desktop application:

```sh
npm run build --workspace=examples/vanilla
```

### Nuxt

```sh
npm run dev --workspace=examples/nuxt
```

The window opens the Nuxt welcome page. Change [app.vue](examples/nuxt/src/renderer/app.vue) to build your UI, and use [nuxt.config.ts](examples/nuxt/src/renderer/nuxt.config.ts) for renderer settings. The [main process](examples/nuxt/src/main/index.ts) loads the renderer with the same `serve()` helper as the vanilla example.

Vitron detects Nuxt from the example's dependencies and starts its development server. Production builds generate static renderer files; the packaged application does not start a Nuxt SSR server.

To build the desktop application:

```sh
npm run build --workspace=examples/nuxt
```

Both examples write desktop output to their own `dist/` directory. Their [packaging configuration](examples/vanilla/electron-builder.mjs) uses the installed Electron version, including when npm hoists Electron to the workspace root. Each example's `electron-builder.yml` defines the application identity and platform targets.

## Connect your renderer to Electron

A desktop UI often needs an operation that runs in Electron's main process. This is the pattern used by the vanilla example: register a handler, expose one preload function, and call it from the page.

**Main process: handle the request.** In `src/main/index.ts`, register the handler before loading the renderer window:

```ts
import { ipcMain } from 'electron';

ipcMain.handle('ping', () => 'pong');
```

**Preload: expose the API.** In `src/preload/index.ts`, use `provide()` to make an application-specific function available to the page:

```ts
import { ipcRenderer } from 'electron';
import { provide } from 'vitron/preload';

provide('vitron', {
    ping: (): Promise<string> => ipcRenderer.invoke('ping'),
});
```

The scaffold's main process already points its window at the built preload script. Keep the API narrow: expose the operations your UI needs through Electron's context bridge.

**Renderer: call the API.** In `src/renderer/main.ts`, retrieve the same key with `inject()`:

```ts
import { inject } from 'vitron/renderer';

const desktop = inject<{ ping: () => Promise<string> }>('vitron');

desktop.ping().then((message) => {
    document.body.textContent = `Electron replied: ${message}`;
}).catch(console.error);
```

The page now displays `Electron replied: pong`. `inject()` throws if the preload has not exposed the key; its type argument describes your API contract without validating it at runtime. For the complete window lifecycle and preload setup, read the [vanilla main process](examples/vanilla/src/main/index.ts).

## Dig deeper

| You want to… | Read |
| --- | --- |
| Install Vitron in your own project | [Installation and setup](packages/vitron/README.md#installation) |
| Change the development port or packaging command | [CLI usage and flags](packages/vitron/README.md#usage) |
| Load renderer files and expose preload APIs | [Runtime helpers](packages/vitron/README.md#runtime-helpers) |
| Change source directories or customize Vite | [Configuration options](packages/vitron/README.md#configuration) |
| Understand framework and packaging limits | [Notes](packages/vitron/README.md#notes) |
| Explore the generated starting point | [Application templates](packages/vitron/assets/templates/) |

The [vitron package reference](packages/vitron/README.md) covers the CLI and the `vitron/main`, `vitron/preload` and `vitron/renderer` exports.

## Packages

| Package | Version | Purpose |
| --- | --- | --- |
| [vitron](packages/vitron/) | [![npm](https://img.shields.io/npm/v/vitron)](https://www.npmjs.com/package/vitron) | CLI plus `vitron/main`, `vitron/preload` and `vitron/renderer` helpers |

## Development

```sh
npm run build
npm test
npm run lint
```

The root build includes both desktop packages. Tests build the CLI first, so a clean checkout does not need an earlier build to run them. Application code and working examples live under [packages/vitron](packages/vitron/) and [examples](examples/).

## License

Made with 💚

Published under the [MIT License](LICENSE).

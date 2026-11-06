<p align="center"><img src=".github/assets/logo.svg" width="144" height="144" alt="Vitron: a desktop window connecting its renderer and host panes"></p>
<h1 align="center">Vitron</h1>
<p align="center"><strong>This is a library to build beautiful (win, linux, mac) desktop apps for modern web projects with vite and electron.</strong></p>
<p align="center">Develop your renderer with Vite, watch Electron's main and preload code, and package the application with electron-builder.</p>
<p align="center">
  <a href="https://www.npmjs.com/package/vitron"><img src="https://img.shields.io/npm/v/vitron" alt="vitron npm version"></a>
  <a href="https://github.com/tada5hi/vitron/actions/workflows/main.yml"><img src="https://github.com/tada5hi/vitron/actions/workflows/main.yml/badge.svg" alt="Continuous integration"></a>
  <a href="LICENSE"><img src="https://img.shields.io/github/license/tada5hi/vitron" alt="MIT license"></a>
</p>
<p align="center"><a href="#why-vitron">Why Vitron?</a> · <a href="#try-an-example">Try an example</a> · <a href="packages/vitron/README.md">Package reference</a> · <a href="#development">Development</a></p>

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

The same main-process call chooses the development URL or the packaged renderer. See the [package reference](packages/vitron/README.md) for the preload bridge and configuration options.

## Packages

| Package | Version | Purpose |
| --- | --- | --- |
| [vitron](packages/vitron/) | [![npm](https://img.shields.io/npm/v/vitron)](https://www.npmjs.com/package/vitron) | CLI plus `vitron/main`, `vitron/preload` and `vitron/renderer` helpers |

## Try an example

Use Node.js 24.15+ on the 24.x line, or Node.js 26+, to work on this repository. The published package has its own [runtime and peer requirements](packages/vitron/README.md#installation).

```sh
git clone https://github.com/tada5hi/vitron.git
cd vitron
npm ci
npm run build --workspace=vitron
npm run dev --workspace=examples/vanilla
```

The vanilla window displays the result of a `ping()` call through its preload bridge. Close the development command before starting another example.

```sh
npm run dev --workspace=examples/nuxt
```

Build either desktop application with its installed Electron version:

```sh
npm run build --workspace=examples/vanilla
npm run build --workspace=examples/nuxt
```

The examples allow compatible Electron updates with `^38.1.2`. Their packaging configuration resolves the installed version, including a hoisted workspace installation.

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

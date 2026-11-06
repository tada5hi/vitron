# Testing and tooling

`npm test` runs the library's Vitest suite through Nx. The package pretest builds the CLI, so a clean checkout needs no separate manual build to run tests. Unit tests live in `packages/vitron/test/unit/`; their config is `packages/vitron/test/vitest.config.mts`.

The suite covers framework/package detection, Node builtin externalization, the built CLI, packaging error propagation, actual local HTTP serving, preload API shape and example window activation. HTTP tests require permission to bind loopback sockets. They exercise success, missing-file and startup/load failure paths without publishing or contacting an application backend.

```sh
npm test --workspace=vitron
npm run test:e2e
npm run build --workspace=vitron
npm run lint
```

`npm run test:e2e` builds the library and runs the separate Playwright Electron suite in `packages/vitron/test/e2e/`, configured by root `playwright.config.ts`. It uses one worker and the Electron binary installed with the examples; no Playwright browser download is needed. Local runs need a desktop session. Linux needs Electron system libraries and a display; CI installs them and supplies Xvfb:

```sh
npx playwright install-deps chromium
xvfb-run --auto-servernum npm run test:e2e
```

The E2E suite exercises vanilla and Nuxt in development and as real unpacked applications. Development checks cover renderer updates in both examples, plus vanilla preload IPC updates and main-process restart. Built checks confirm packaged state, loopback production serving and renderer content, including vanilla IPC. Fixtures copy the examples so source edits, generated output and application data stay isolated; teardown bounds tracing and graceful shutdown, then stops process trees before removing the copies. Packaging reuses installed Electron, creates unpacked output and disables signing and publishing.

Playwright writes its HTML report to `playwright-report/` and failure diagnostics to `test-results/`. Inspect the report with `npx playwright show-report`; the Ubuntu E2E job uploads both directories when it fails. Keep `npm test` as the fast unit suite and run E2E separately when changing CLI startup, rebuild/reload behavior, preload integration, renderer serving or example packaging.

The package build uses tsdown for CJS/ESM JavaScript and declarations. The example `vitron build` commands also invoke electron-builder; an unsuccessful packager must cause a nonzero build exit. Root builds validate both examples, while CI's shared build action prepares the library's export artifacts.

`@tada5hi/eslint-config` supplies the flat ESLint configuration, including checks on these guides. Vitest uses its V8 coverage provider and the thresholds in its test configuration. Release-please manages releases and monoship publishes packages; do not publish or hand-edit release versions during ordinary development.

Dependency compatibility: `@routup/static` requires the supported routup major declared by its peer range. Upgrade the pair together and retain the real HTTP regression. Electron examples retain a compatible dependency range. Their `electron-builder.mjs` configuration extends the YAML options and reads the installed Electron version so packaging follows npm workspace updates.

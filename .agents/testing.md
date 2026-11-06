# Testing and tooling

`npm test` runs the library's Vitest suite through Nx. The package pretest builds the CLI, so a clean checkout needs no separate manual build to run tests. Unit tests live in `packages/vitron/test/unit/`; their config is `packages/vitron/test/vitest.config.mts`.

The suite covers framework/package detection, Node builtin externalization, the built CLI, packaging error propagation, actual local HTTP serving, preload API shape and example window activation. HTTP tests require permission to bind loopback sockets. They exercise success, missing-file and startup/load failure paths without publishing or contacting an application backend.

```sh
npm test --workspace=vitron
npm run build --workspace=vitron
npm run lint
```

The package build uses tsdown for CJS/ESM JavaScript and declarations. The example `vitron build` commands also invoke electron-builder; an unsuccessful packager must cause a nonzero build exit. Root builds validate both examples, while CI's shared build action prepares the library's export artifacts.

`@tada5hi/eslint-config` supplies the flat ESLint configuration, including checks on these guides. Vitest uses its V8 coverage provider and the thresholds in its test configuration. Release-please manages releases and monoship publishes packages; do not publish or hand-edit release versions during ordinary development.

Dependency compatibility: `@routup/assets` requires the supported routup major declared by its peer range. Upgrade the pair together and retain the real HTTP regression. Electron examples retain a compatible dependency range. Their `electron-builder.mjs` configuration extends the YAML options and reads the installed Electron version so packaging follows npm workspace updates.

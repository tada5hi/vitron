# Vitron agent guide

Vitron builds and develops Electron applications with Vite. The npm workspace contains the `vitron` library/CLI and vanilla, Nuxt and Next.js example applications.

## Development

Use Node.js 24.15+ on the 24.x line, or Node.js 26+. Contributor tools and published runtime requirements differ; check `packages/vitron/package.json` for the public engine and peer contracts.

```sh
npm ci
npm run build
npm test
npm run lint
npm run dev --workspace=examples/vanilla
npm run dev --workspace=examples/nuxt
```

The root build packages both examples with electron-builder. Each example allows compatible Electron minor and patch updates. Its ES module packaging configuration resolves the installed Electron version, including hoisted npm workspace dependencies. The library's pretest script builds the CLI so tests work after a clean checkout.

## Guides

- [Structure and architecture](.agents/architecture.md)
- [Testing and tooling](.agents/testing.md)

## Writing agent docs

Keep existing commands, paths and factual descriptions current. Add guide content only for an invariant or cross-cutting rule. Describe current behavior and verified commands. Keep task history and defect narratives in commits or PRs; edit existing guidance rather than appending a section per fix. Keep detailed topics on demand and use `npm run lint` to check the guides.

## Commits and pull requests

Use Conventional Commits. Do not add AI-attribution trailers or generated-by lines to commits, issues, PRs or comments.

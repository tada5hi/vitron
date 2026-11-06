# Playwright integration design

## Intent and scope

Add real Electron integration tests for Vitron's vanilla and Nuxt examples. The user selected both examples in development and built mode. Keep the existing fast Vitest suite and public runtime contracts intact.

## Approaches

- **Selected:** exercise both examples, with real development startup and production renderer serving. This covers framework integration as well as the vanilla preload bridge.
- Start with vanilla alone: smaller setup, but misses the external Nuxt development server and generated renderer path.

## Proposed behavior

- Add `@playwright/test` as a root development dependency and a separate `npm run test:e2e` command that builds the library first. Keep `npm test` as the current unit suite.
- Configure a serial Playwright suite with bounded startup/test timeouts, an HTML report, and failure diagnostics. Use the installed Electron binary; no separate browser download is needed.
- Copy each example into a temporary fixture and link the workspace dependencies. All source edits, generated output and Electron user data stay in the fixture. Cleanup must stop the entire CLI/renderer/Electron process tree before deleting it, including when startup or assertions fail.
- Development tests run the built `vitron dev` CLI with the fixture as cwd and workspace binaries on PATH. A test-only addition to the copied main source enables a loopback CDP port. Playwright connects to the CLI-owned Electron window through CDP; production code gains no testing flags.
- Assert the vanilla renderer receives `pong` through its real preload/main IPC bridge and the Nuxt renderer displays its welcome content. Modify copied renderer source and wait for the changed content in the Electron window, without a manual reload or fixed sleeps. Also exercise vanilla preload rebuilding/reloading and main-process rebuilding/restart if the launch lifecycle supports a reliable bounded assertion.
- Built-mode tests run the actual `vitron build` CLI with a fixture-only electron-builder config extending the example configuration. Set platform targets to `dir`, reuse the installed Electron distribution, disable signing, and keep publishing disabled. Launch the resulting unpacked application executable with Playwright's Electron API. Assert `app.isPackaged`, content, vanilla IPC, and a working loopback production renderer URL with no Vite dev server running. This is necessary because `serve()` selects its production branch using `app.isPackaged`.
- CI adds an Ubuntu Electron E2E job using Xvfb, installs the needed system dependencies, and uploads reports/diagnostics on failure. Local documentation explains commands, display requirements and where artifacts go.

## Boundaries and builder decisions

Built mode means a real unpacked application containing the production `.vitron` output, without creating a signed installer. Installer generation, release publishing, browser matrices, screenshot baselines and new runtime abstractions are outside this change. Ubuntu is the initial CI platform; local verification runs on the current macOS host. Playwright's Electron support is experimental, so the integration stays isolated from library dependencies.

The builder may settle fixture layout, port selection, concrete locators, timeout values, and diagnostic filenames. Reuse existing utilities/dependencies where possible, and keep the harness proportional to four example/mode scenarios. Any discovered production defect gets a focused regression test and the smallest fix needed for this scope.

## Validation

Verify the unmodified Vitest baseline with loopback permissions, run the real Electron suite, run lint and relevant TypeScript checks, and use a separate agent to review lifecycle cleanup and the resulting diff. Tests must fail when expected content/IPC changes are withheld; restore copied sources through fixture deletion rather than changing tracked examples.

import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import {
    access,
    cp,
    mkdir,
    mkdtemp,
    readFile,
    rm,
    symlink,
    writeFile,
} from 'node:fs/promises';
import { createRequire } from 'node:module';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';
import {
    _electron,
    test as base,
    chromium,
    expect,
} from '@playwright/test';
import type {
    Browser,
    BrowserContext,
    ElectronApplication,
    Page,
} from '@playwright/test';
import { getRandomPort } from 'get-port-please';

const workspace = path.resolve(__dirname, '../..');
const requireFromFixture = createRequire(__filename);
const cliPath = path.join(path.dirname(requireFromFixture.resolve('vitron/package.json')), requireFromFixture('vitron/package.json').bin.vitron);

async function finishWithin(operation: Promise<unknown>) {
    let timer: ReturnType<typeof setTimeout> | undefined;

    try {
        return await Promise.race([
            operation.then(() => true),
            new Promise<false>((resolve) => {
                timer = setTimeout(() => resolve(false), 5000);
            }),
        ]);
    } finally {
        clearTimeout(timer);
    }
}

async function signalTree(child: ChildProcess, signal: NodeJS.Signals) {
    if (!child.pid) {
        return;
    }

    try {
        process.kill(-child.pid, signal);
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ESRCH') {
            throw error;
        }
    }
}

type Example = {
    root: string,
    connect: () => Promise<Page>,
    startDev: () => Promise<Page>,
    stopDev: () => Promise<void>,
    startBuilt: () => Promise<{ electron: ElectronApplication, page: Page }>,
};

export async function replaceSource(root: string, file: string, before: string, after: string) {
    const filePath = path.join(root, file);
    const source = await readFile(filePath, 'utf8');

    expect(source).toContain(before);
    await writeFile(filePath, source.replace(before, after));
}

export const test = base.extend<{ exampleName: 'vanilla' | 'nuxt', example: Example }>({
    exampleName: ['vanilla', { option: true }],
    example: async ({ exampleName }, use, testInfo) => {
        // shortcut: Windows needs process-tree ownership after a CLI crash; add a Windows lifecycle runner before enabling.
        test.skip(process.platform === 'win32', 'Electron E2E currently supports macOS and Linux.');

        await access(requireFromFixture('electron'));

        const directory = await mkdtemp(path.join(tmpdir(), 'vitron-e2e-'));
        const root = path.join(directory, 'examples', exampleName);
        const children: ChildProcess[] = [];
        const browsers: Browser[] = [];
        const contexts: BrowserContext[] = [];
        let electron: ElectronApplication | undefined;
        let electronProcess: ChildProcess | undefined;
        let currentPage: Page | undefined;
        let output = '';
        let debugPort: number;
        let rendererPort: number;
        let dev: ChildProcess | undefined;
        const env: NodeJS.ProcessEnv = {
            ...process.env,
            PATH: `${path.join(workspace, 'node_modules', '.bin')}${path.delimiter}${process.env.PATH}`,
            NUXT_TELEMETRY_DISABLED: '1',
            CSC_IDENTITY_AUTO_DISCOVERY: 'false',
        };

        delete env.ELECTRON_RUN_AS_NODE;

        const run = (args: string[]) => {
            const child = spawn(process.execPath, [cliPath, ...args], {
                cwd: root,
                env,
                detached: true,
                stdio: ['ignore', 'pipe', 'pipe'],
            });

            children.push(child);
            child.stdout.on('data', (data: Buffer) => {
                output += data.toString();
            });
            child.stderr.on('data', (data: Buffer) => {
                output += data.toString();
            });
            child.on('error', (error) => {
                output += `${error.stack}\n`;
            });

            return child;
        };

        const watch = async (page: Page) => {
            currentPage = page;
            page.on('console', (message) => {
                output += `[renderer:${message.type()}] ${message.text()}\n`;
            });
            page.on('pageerror', (error) => {
                output += `[renderer:error] ${error.stack}\n`;
            });
            contexts.push(page.context());
            await page.context().tracing.start({ screenshots: true, snapshots: true });

            return page;
        };

        const connect = async () => {
            let browser: Browser | undefined;

            await expect.poll(async () => {
                const child = children.at(-1);

                if (!child || child.exitCode !== null || child.signalCode !== null) {
                    throw new Error(`Vitron exited before Electron connected.\n${output}`);
                }

                try {
                    browser = await chromium.connectOverCDP(`http://127.0.0.1:${debugPort}`, { timeout: 1000 });

                    return true;
                } catch {
                    return false;
                }
            }, { timeout: 60_000 }).toBe(true);

            browsers.push(browser!);

            const context = browser!.contexts()[0];
            const page = context.pages()[0] || await context.waitForEvent('page');

            return watch(page);
        };

        try {
            debugPort = await getRandomPort('127.0.0.1');
            await cp(path.join(workspace, 'examples', exampleName), root, {
                recursive: true,
                filter: (source) => !['node_modules', 'dist', '.vitron', '.nuxt', '.output'].includes(path.basename(source)),
            });
            await symlink(path.join(workspace, 'node_modules'), path.join(directory, 'node_modules'), 'junction');
            await cp(path.join(workspace, 'tsconfig.json'), path.join(directory, 'tsconfig.json'));
            await cp(path.join(workspace, 'tsconfig.build.json'), path.join(directory, 'tsconfig.build.json'));
            await mkdir(path.join(directory, 'user-data'));

            const mainFile = path.join(root, 'src/main/index.ts');
            const source = await readFile(mainFile, 'utf8');

            await writeFile(mainFile, source.replace("app.on('window-all-closed'", `app.setPath('userData', ${JSON.stringify(path.join(directory, 'user-data'))});\napp.on('window-all-closed'`));

            await use({
                root,
                connect,
                startDev: async () => {
                    const main = await readFile(mainFile, 'utf8');

                    await writeFile(mainFile, `app.commandLine.appendSwitch('remote-debugging-port', '${debugPort}');\n${main}`);

                    rendererPort = await getRandomPort('127.0.0.1');

                    while (rendererPort === debugPort) {
                        rendererPort = await getRandomPort('127.0.0.1');
                    }

                    dev = run(['dev', '--port', `${rendererPort}`]);

                    return connect();
                },
                stopDev: async () => {
                    expect(dev, 'development must have started').toBeDefined();

                    const child = dev!;
                    const exited = once(child, 'exit');

                    // Signal only the CLI so descendants must be released by the session.
                    expect(child.kill('SIGTERM')).toBe(true);
                    expect(await finishWithin(exited), `CLI must exit naturally after SIGTERM.\n${output}`).toBe(true);
                    expect(child.exitCode, output).toBe(0);
                    expect(child.signalCode).toBeNull();

                    for (const host of ['127.0.0.1', '::1']) {
                        const server = createServer();

                        try {
                            await new Promise<void>((resolve, reject) => {
                                server.once('error', reject);
                                server.listen(rendererPort, host, () => resolve());
                            });
                        } finally {
                            if (server.listening) {
                                await new Promise<void>((resolve, reject) => {
                                    server.close((error) => (error ? reject(error) : resolve()));
                                });
                            }
                        }
                    }
                },
                startBuilt: async () => {
                    const electronDist = path.join(path.dirname(requireFromFixture.resolve('electron/package.json')), 'dist');

                    await writeFile(path.join(root, 'e2e-builder.mjs'), `
import path from 'node:path';
import { writeFile } from 'node:fs/promises';
import base from './electron-builder.mjs';
export default {
    ...base,
    electronDist: ${JSON.stringify(electronDist)},
    npmRebuild: false,
    publish: null,
    mac: { target: 'dir', identity: null },
    linux: { target: 'dir' },
    win: { target: 'dir', signAndEditExecutable: false },
    afterPack: async ({ appOutDir, electronPlatformName, packager }) => {
        const name = packager.appInfo.productFilename;
        const executable = electronPlatformName === 'darwin'
            ? path.join(appOutDir, name + '.app', 'Contents', 'MacOS', name)
            : path.join(appOutDir, electronPlatformName === 'win32' ? name + '.exe' : packager.executableName);
        await writeFile(${JSON.stringify(path.join(root, 'executable-path.txt'))}, executable);
    },
};
`);

                    const build = run(['build', '--config', 'e2e-builder.mjs']);
                    const [code] = await once(build, 'exit', { signal: AbortSignal.timeout(150_000) });

                    expect(code, output).toBe(0);

                    const executablePath = await readFile(path.join(root, 'executable-path.txt'), 'utf8');

                    electron = await _electron.launch({
                        executablePath,
                        cwd: directory,
                        env,
                        timeout: 30_000,
                    });
                    electronProcess = electron.process();
                    children.push(electronProcess);
                    electron.process().stdout?.on('data', (data: Buffer) => {
                        output += data.toString();
                    });
                    electron.process().stderr?.on('data', (data: Buffer) => {
                        output += data.toString();
                    });

                    return { electron, page: await watch(await electron.firstWindow()) };
                },
            });
        } finally {
            const failed = testInfo.status !== testInfo.expectedStatus;
            const cleanup: PromiseSettledResult<unknown>[] = [];

            try {
                if (failed) {
                    await currentPage?.screenshot({ path: testInfo.outputPath('window.png'), timeout: 5000 }).catch(() => {});
                }

                for (const [index, context] of contexts.entries()) {
                    await finishWithin(context.tracing.stop(failed ? { path: testInfo.outputPath(`trace-${index}.zip`) } : {})).catch(() => {});
                }

                if (electron) {
                    await finishWithin(electron.close()).catch(() => {});
                }
            } finally {
                cleanup.push(...await Promise.allSettled(children.map(async (child) => {
                    // The CLI may exit before its renderer; its process group still owns those descendants.
                    await signalTree(child, child === electronProcess ? 'SIGKILL' : 'SIGTERM');

                    if (child.pid && child.exitCode === null && child.signalCode === null) {
                        const exited = once(child, 'exit');

                        if (!await finishWithin(exited)) {
                            await signalTree(child, 'SIGKILL');
                            expect(await finishWithin(exited), 'application process must exit after SIGKILL').toBe(true);
                        }
                    }

                    await signalTree(child, 'SIGKILL');
                })));
                cleanup.push(...await Promise.allSettled(browsers.map((browser) => finishWithin(browser.close()))));

                const errors = cleanup.filter((result) => result.status === 'rejected');

                try {
                    if (failed || errors.length > 0) {
                        const logPath = testInfo.outputPath('application.log');

                        await writeFile(logPath, output);
                        await testInfo.attach('application.log', { path: logPath, contentType: 'text/plain' });
                    }
                } finally {
                    await rm(directory, { recursive: true, force: true });
                }

                expect(errors, 'application cleanup must succeed').toEqual([]);
            }
        }
    },
});

export { expect } from '@playwright/test';

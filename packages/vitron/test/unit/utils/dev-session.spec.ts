import { ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import {
    mkdir,
    mkdtemp,
    readFile,
    rm,
    writeFile,
} from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import spawn from 'cross-spawn';
import { getRandomPort } from 'get-port-please';
import { createLogger } from 'vite';
import type { InlineConfig, ViteDevServer } from 'vite';
import * as vite from 'vite';
import {
    afterEach,
    beforeEach,
    expect,
    it,
    vi,
} from 'vitest';
import { runDevelopmentSession } from '../../../src/apps/dev';
import { buildConfig } from '../../../src/config/utils/build';
import * as rendererProcesses from '../../../src/apps/renderer/ps';

vi.mock('cross-spawn', () => ({ default: vi.fn() }));
vi.mock('vite', async (importOriginal) => {
    const actual = await importOriginal<typeof vite>();

    return { ...actual, createServer: vi.fn(actual.createServer) };
});

const directories: string[] = [];
const sessions: { controller: AbortController, result: Promise<unknown> }[] = [];
let children: ChildProcess[];
let events: string[];
let nextSpawnFailure: Error | undefined;
let releaseElectron: (() => void) | undefined;

beforeEach(async () => {
    children = [];
    events = [];
    nextSpawnFailure = undefined;
    releaseElectron = undefined;
    vi.mocked(vite.createServer).mockImplementation((await vi.importActual<typeof vite>('vite')).createServer);
    vi.mocked(spawn).mockImplementation(() => {
        const child = new ChildProcess();
        const failure = nextSpawnFailure;

        nextSpawnFailure = undefined;
        children.push(child);
        events.push('electron:start');
        vi.spyOn(child, 'kill').mockImplementation(() => {
            events.push('electron:stop');

            const close = () => child.emit('close', 0, null);

            if (releaseElectron) {
                releaseElectron = close;
            } else {
                queueMicrotask(close);
            }

            return true;
        });
        queueMicrotask(() => child.emit(failure ? 'error' : 'spawn', failure));

        return child;
    });
});

afterEach(async () => {
    for (const { controller } of sessions) {
        controller.abort();
    }

    await new Promise(setImmediate);
    releaseElectron?.();
    await Promise.all(sessions.splice(0).map(({ result }) => result));
    await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
    vi.restoreAllMocks();
});

async function fixture(preload = true) {
    const root = await mkdtemp(path.join(tmpdir(), 'vitron-session-'));

    directories.push(root);
    await mkdir(path.join(root, 'src/main'), { recursive: true });
    await mkdir(path.join(root, 'src/renderer'), { recursive: true });
    await writeFile(path.join(root, 'package.json'), '{"name":"session-fixture"}');
    await writeFile(path.join(root, 'src/main/index.ts'), 'export const value = "initial";');
    await writeFile(path.join(root, 'src/renderer/index.html'), '<h1>session renderer</h1>');

    if (preload) {
        await mkdir(path.join(root, 'src/preload'), { recursive: true });
        await writeFile(path.join(root, 'src/preload/index.ts'), 'export const value = "initial";');
    }

    let server: ViteDevServer | undefined;
    let reloadFailure: Error | undefined;
    const watchConfig = (name: string) => () : InlineConfig => ({
        configFile: false,
        logLevel: 'silent',
        plugins: [{
            name: `observe-${name}`,
            writeBundle() {
                events.push(`${name}:built`);
            },
            closeWatcher() {
                events.push(`${name}:closed`);
            },
        }],
    });
    const config = buildConfig({
        rootPath: root,
        port: await getRandomPort('127.0.0.1'),
        mainConfig: watchConfig('main'),
        preloadConfig: watchConfig('preload'),
        rendererConfig(input) {
            input.configFile = false;
            input.logLevel = 'silent';
            input.server = {
                host: '127.0.0.1',
                strictPort: true,
                watch: null,
            };
            input.plugins = [{
                name: 'observe-renderer',
                configureServer(value) {
                    server = value;
                    events.push('renderer:created');

                    const send = value.ws.send.bind(value.ws);

                    value.ws.send = (...args: Parameters<typeof send>) => {
                        if (args[0] && typeof args[0] === 'object' && args[0].type === 'full-reload') {
                            events.push('renderer:reload');

                            if (reloadFailure) {
                                throw reloadFailure;
                            }
                        }

                        return send(...args);
                    };
                },
                closeBundle() {
                    events.push('renderer:closed');
                },
            }];

            return {};
        },
    });
    const controller = new AbortController();
    let outcome: unknown = 'pending';
    const start = () => {
        const result = runDevelopmentSession(config, createLogger('silent'), controller.signal).then(
            () => {
                outcome = 'stopped';
            },
            (error) => {
                outcome = error;
            },
        );

        sessions.push({ controller, result });

        return result;
    };

    return {
        root,
        config,
        controller,
        start,
        outcome: () => outcome,
        server: () => server,
        failReload: (error: Error) => {
            reloadFailure = error;
        },
        edit: (app: string, value: string) => writeFile(path.join(root, `src/${app}/index.ts`), `export const value = ${JSON.stringify(value)};`),
        ready: () => vi.waitFor(() => expect(children.length).toBe(1), { timeout: 5000 }),
    };
}

it.each([true, false])('owns startup in main/preload/renderer/Electron order (preload=%s)', async (preload) => {
    const app = await fixture(preload);
    const result = app.start();

    await app.ready();
    expect(events.slice(0, preload ? 4 : 3)).toEqual(preload ?
        ['main:built', 'preload:built', 'renderer:created', 'electron:start'] :
        ['main:built', 'renderer:created', 'electron:start']);
    expect(await (await fetch(`http://127.0.0.1:${app.config.get('port')}`)).text()).toContain('session renderer');
    app.controller.abort();
    app.controller.abort();
    await result;
    expect(app.outcome()).toBe('stopped');
    expect(events).toContain('main:closed');
    expect(events.includes('preload:closed')).toBe(preload);
    expect(app.server()?.httpServer?.listening).toBe(false);
    expect(events.filter((event) => event === 'electron:stop')).toHaveLength(1);
});

it('rolls back a successful main watcher when initial preload compilation fails', async () => {
    const app = await fixture();

    await writeFile(path.join(app.root, 'src/preload/index.ts'), 'export const broken = ;');
    await app.start();
    expect(app.outcome()).toBeInstanceOf(Error);
    expect(events).toContain('main:closed');
    expect(events).toContain('preload:closed');
    expect(children).toHaveLength(0);
});

it('closes the main watcher when cancelled before its first readiness', async () => {
    const app = await fixture();
    const compiling = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();

    app.config.set('mainConfig', () => {
        const config: InlineConfig = {};

        config.configFile = false;
        config.logLevel = 'silent';
        config.plugins = [{
            name: 'pending-first-build',
            async buildStart() {
                compiling.resolve();
                await release.promise;
            },
            closeWatcher() {
                events.push('main:closed');
            },
        }];

        return config;
    });

    const result = app.start();

    try {
        await compiling.promise;
        app.controller.abort();
        release.resolve();
        await result;
        expect(app.outcome()).toBe('stopped');
        expect(events).toEqual(['main:closed']);
        expect(children).toHaveLength(0);
    } finally {
        release.resolve();
    }
});

it('awaits and closes a renderer acquired after cancellation without launching Electron', async () => {
    const app = await fixture();
    const acquired = Promise.withResolvers<ViteDevServer>();
    let waiting = false;
    const realCreate = (await vi.importActual<typeof vite>('vite')).createServer;
    let server: ViteDevServer | undefined;

    vi.mocked(vite.createServer).mockImplementationOnce(async (config) => {
        server = await realCreate(config);
        waiting = true;

        return acquired.promise;
    });

    const result = app.start();

    try {
        await vi.waitFor(() => expect(waiting).toBe(true));
        app.controller.abort();
        await new Promise(setImmediate);
        expect(app.outcome()).toBe('pending');
        acquired.resolve(server!);
        await result;
        expect(app.outcome()).toBe('stopped');
        expect(events).toContain('renderer:closed');
        expect(children).toHaveLength(0);
    } finally {
        if (server) {
            acquired.resolve(server);
        }
    }
});

it('ignores preload rebuilds until external renderer readiness finishes', async () => {
    const app = await fixture();
    let ready = false;
    let requested = false;
    const server = createServer((_request, response) => {
        requested = true;
        response.statusCode = ready ? 200 : 503;
        response.end('external renderer');
    });

    server.listen(app.config.get('port'));
    await once(server, 'listening');

    const child = new ChildProcess();
    const kill = vi.spyOn(child, 'kill');

    vi.spyOn(rendererProcesses, 'spawnRendererProcess').mockReturnValue(child);

    const result = app.start();

    try {
        await vi.waitFor(() => expect(requested).toBe(true));
        await app.edit('preload', 'during-startup');
        await vi.waitFor(() => expect(events.filter((event) => event === 'preload:built')).toHaveLength(2));
        await new Promise(setImmediate);
        expect(kill).not.toHaveBeenCalled();
        ready = true;
        await app.ready();
        expect(app.outcome()).toBe('pending');
        app.controller.abort();
        await result;
        expect(app.outcome()).toBe('stopped');
    } finally {
        app.controller.abort();
        await result;
        server.closeAllConnections();
        await new Promise<void>((resolve) => {
            server.close(() => resolve());
        });
    }
});

it('restarts Electron on main rebuilds and reloads the running renderer on preload rebuilds', async () => {
    const app = await fixture();
    const result = app.start();

    await app.ready();
    await app.edit('main', 'replacement');
    await vi.waitFor(() => expect(children).toHaveLength(2));
    expect(events.indexOf('electron:stop')).toBeLessThan(events.lastIndexOf('electron:start'));
    await app.edit('preload', 'reload');
    await vi.waitFor(() => expect(events).toContain('renderer:reload'));
    app.controller.abort();
    await result;
    expect(app.outcome()).toBe('stopped');
});

it('waits for an in-flight restart and suppresses its replacement during shutdown', async () => {
    const app = await fixture();
    const result = app.start();

    await app.ready();
    releaseElectron = () => {};
    await app.edit('main', 'pending-restart');
    await vi.waitFor(() => expect(events).toContain('electron:stop'));
    app.controller.abort();
    await new Promise(setImmediate);
    expect(app.outcome()).toBe('pending');
    await app.edit('preload', 'stopping');
    releaseElectron();
    await result;
    expect(children).toHaveLength(1);
    expect(events).not.toContain('renderer:reload');
    expect(app.outcome()).toBe('stopped');
});

it.each(['initial', 'replacement'])('rolls back on %s Electron spawn failure', async (stage) => {
    const app = await fixture();
    const failure = new Error('Electron cannot launch');

    if (stage === 'initial') {
        nextSpawnFailure = failure;
    }

    const result = app.start();

    if (stage === 'replacement') {
        await app.ready();
        nextSpawnFailure = failure;
        await app.edit('main', 'failed-replacement');
    }

    await result;
    expect(app.outcome()).toBe(failure);
    expect(events).toContain('main:closed');
    expect(events).toContain('preload:closed');
    expect(app.server()?.httpServer?.listening).toBe(false);
});

it('ends the session and releases both watchers when renderer reload rejects', async () => {
    const app = await fixture();
    const failure = new Error('renderer reload failed');
    const result = app.start();

    await app.ready();
    app.failReload(failure);
    await app.edit('preload', 'failed-reload');
    await result;
    expect(app.outcome()).toBe(failure);
    expect(events).toContain('main:closed');
    expect(events).toContain('preload:closed');
    expect(events).toContain('electron:stop');
    expect(app.server()?.httpServer?.listening).toBe(false);
});

it('continues other cleanup and preserves the operational error when watcher close rejects', async () => {
    const app = await fixture();
    const operational = new Error('reload failed');
    const cleanup = new Error('main close failed');
    const customize = app.config.get('mainConfig')!;

    app.config.set('mainConfig', (config) => {
        const result = customize(config);

        result.plugins!.push({
            name: 'fail-close',
            closeWatcher() {
                throw cleanup;
            },
        });

        return result;
    });

    const result = app.start();

    await app.ready();
    app.failReload(operational);
    await app.edit('preload', 'failed-reload');
    await result;
    expect(app.outcome()).toMatchObject({ errors: [operational, cleanup] });
    expect(events).toContain('preload:closed');
    expect(events).toContain('renderer:closed');
    expect(events).toContain('electron:stop');
    expect(await readFile(path.join(app.root, '.vitron/main/index.js'), 'utf8')).toContain('initial');
});

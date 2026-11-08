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
import { setTimeout as delay } from 'node:timers/promises';
import spawn from 'cross-spawn';
import { getRandomPort } from 'get-port-please';
import { createLogger } from 'vite';
import type { InlineConfig, ViteDevServer } from 'vite';
import {
    afterEach,
    beforeEach,
    expect,
    it,
    vi,
} from 'vitest';
import { runDevelopmentSession } from '../../../src/apps/dev';
import * as rendererProcesses from '../../../src/apps/renderer/ps';
import { buildConfig } from '../../../src/config/utils/build';

vi.mock('cross-spawn', () => ({ default: vi.fn() }));

const directories: string[] = [];
const sessions: { controller: AbortController, result: Promise<unknown> }[] = [];
let children: ChildProcess[];
let liveChildren: Set<ChildProcess>;
let events: string[];
let nextSpawnFailure: Error | undefined;
let holdElectronClose: boolean;
let closeHeldElectron: (() => void) | undefined;

beforeEach(() => {
    children = [];
    liveChildren = new Set();
    events = [];
    nextSpawnFailure = undefined;
    holdElectronClose = false;
    closeHeldElectron = undefined;

    vi.mocked(spawn).mockImplementation(() => {
        const child = new ChildProcess();
        const failure = nextSpawnFailure;

        nextSpawnFailure = undefined;
        children.push(child);
        events.push('electron:start');
        child.once('spawn', () => liveChildren.add(child));
        child.once('close', () => liveChildren.delete(child));
        vi.spyOn(child, 'kill').mockImplementation(() => {
            events.push('electron:stop');

            const close = () => child.emit('close', 0, null);

            if (holdElectronClose) {
                closeHeldElectron = close;
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
    closeHeldElectron?.();
    await Promise.all(sessions.splice(0).map(({ result }) => result));
    await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
    vi.restoreAllMocks();
});

function count(event: string) {
    return events.filter((entry) => entry === event).length;
}

function observedWatch(name: string) {
    return () : InlineConfig => ({
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
}

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

    const config = buildConfig({
        rootPath: root,
        port: await getRandomPort('127.0.0.1'),
        mainConfig: observedWatch('main'),
        preloadConfig: observedWatch('preload'),
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
        built: (app: string) => readFile(path.join(root, `.vitron/${app}/index.js`), 'utf8'),
        electronLive: () => vi.waitFor(() => expect(liveChildren.size).toBeGreaterThan(0), { timeout: 5000 }),
    };
}

function expectEverythingReleased(app: Awaited<ReturnType<typeof fixture>>) {
    expect(events).toContain('main:closed');
    expect(events).toContain('preload:closed');
    expect(events).toContain('renderer:closed');
    expect(app.server()?.httpServer?.listening).toBe(false);
    expect(liveChildren.size).toBe(0);
}

it('starts main, preload, renderer, then Electron in order', async () => {
    const app = await fixture();
    const result = app.start();

    await app.electronLive();
    expect([...new Set(events)].slice(0, 4)).toEqual(['main:built', 'preload:built', 'renderer:created', 'electron:start']);
    expect(await (await fetch(`http://127.0.0.1:${app.config.get('port')}`)).text()).toContain('session renderer');

    app.controller.abort();
    await result;
    expect(app.outcome()).toBe('stopped');
    expectEverythingReleased(app);
});

it('skips a missing preload', async () => {
    const app = await fixture(false);
    const result = app.start();

    await app.electronLive();
    expect([...new Set(events)].slice(0, 3)).toEqual(['main:built', 'renderer:created', 'electron:start']);
    expect(events).not.toContain('preload:built');

    app.controller.abort();
    await result;
    expect(app.outcome()).toBe('stopped');
    expect(events).toContain('main:closed');
    expect(events).not.toContain('preload:closed');
});

it('rolls back the main watcher when preload compilation fails', async () => {
    const app = await fixture();

    await writeFile(path.join(app.root, 'src/preload/index.ts'), 'export const broken = ;');
    await app.start();

    expect(app.outcome()).toBeInstanceOf(Error);
    expect(events).toContain('main:closed');
    expect(events).toContain('preload:closed');
    expect(children).toHaveLength(0);
});

it('closes watchers when cancelled before first readiness', async () => {
    const app = await fixture();
    const compiling = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();

    app.config.set('mainConfig', () => ({
        configFile: false,
        logLevel: 'silent',
        plugins: [{
            name: 'pending-first-build',
            async buildStart() {
                compiling.resolve();
                await release.promise;
            },
            closeWatcher() {
                events.push('main:closed');
            },
        }],
    }));

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

it('cancels a pending renderer startup without launching Electron', async () => {
    const app = await fixture();
    const child = new ChildProcess();
    const kill = vi.spyOn(child, 'kill').mockReturnValue(true);
    const spawnRenderer = vi.spyOn(rendererProcesses, 'spawnRendererProcess').mockReturnValue(child);
    const result = app.start();

    await vi.waitFor(() => expect(spawnRenderer).toHaveBeenCalled(), { timeout: 5000 });
    app.controller.abort();
    await result;

    expect(app.outcome()).toBe('stopped');
    expect(kill).toHaveBeenCalledOnce();
    expect(events).toContain('main:closed');
    expect(events).toContain('preload:closed');
    expect(children).toHaveLength(0);
});

it('ignores preload rebuilds until the renderer is ready', async () => {
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
    const kill = vi.spyOn(child, 'kill').mockReturnValue(true);
    const spawnRenderer = vi.spyOn(rendererProcesses, 'spawnRendererProcess').mockReturnValue(child);
    const result = app.start();

    try {
        await vi.waitFor(() => expect(requested).toBe(true), { timeout: 5000 });
        await app.edit('preload', 'during-startup');
        await vi.waitFor(async () => expect(await app.built('preload')).toContain('during-startup'), { timeout: 5000 });
        await new Promise(setImmediate);

        expect(kill).not.toHaveBeenCalled();
        expect(spawnRenderer).toHaveBeenCalledOnce();

        ready = true;
        await app.electronLive();
        expect(app.outcome()).toBe('pending');
    } finally {
        app.controller.abort();
        await result;
        server.closeAllConnections();
        await new Promise((resolve) => {
            server.close(resolve);
        });
    }

    expect(app.outcome()).toBe('stopped');
});

it('restarts Electron on main rebuilds and reloads the renderer on preload rebuilds', async () => {
    const app = await fixture();
    const result = app.start();

    await app.electronLive();

    const initial = [...liveChildren][0];

    await app.edit('main', 'replacement');
    await vi.waitFor(async () => {
        expect(await app.built('main')).toContain('replacement');
        expect(liveChildren.size).toBe(1);
        expect([...liveChildren][0]).not.toBe(initial);
    }, { timeout: 5000 });
    expect(events.indexOf('electron:stop')).toBeLessThan(events.lastIndexOf('electron:start'));

    await app.edit('preload', 'reload');
    await vi.waitFor(() => expect(count('renderer:reload')).toBe(1), { timeout: 5000 });
    expect(await app.built('preload')).toContain('reload');

    app.controller.abort();
    await result;
    expect(app.outcome()).toBe('stopped');
});

it('suppresses a queued restart during shutdown', async () => {
    const app = await fixture();
    const result = app.start();

    await app.electronLive();

    holdElectronClose = true;
    await app.edit('main', 'queued-restart');
    await vi.waitFor(() => expect(count('electron:stop')).toBe(1), { timeout: 5000 });

    app.controller.abort();
    await new Promise(setImmediate);
    expect(app.outcome()).toBe('pending');

    await app.edit('preload', 'after-abort');
    await vi.waitFor(async () => expect(await app.built('preload')).toContain('after-abort'), { timeout: 5000 });
    await delay(50);
    closeHeldElectron!();
    await result;

    expect(app.outcome()).toBe('stopped');
    expect(children).toHaveLength(1);
    expect(count('renderer:reload')).toBe(0);
    expect(liveChildren.size).toBe(0);
});

it.each(['restart', 'reload'])('treats a rejected %s as fatal and cleans up', async (reaction) => {
    const app = await fixture();
    const failure = new Error(`${reaction} failed`);
    const result = app.start();

    await app.electronLive();

    if (reaction === 'restart') {
        nextSpawnFailure = failure;
        await app.edit('main', 'failed-restart');
    } else {
        app.failReload(failure);
        await app.edit('preload', 'failed-reload');
    }

    await result;

    expect(app.outcome()).toBe(failure);
    expectEverythingReleased(app);
});

it('rejects when Electron fails to launch and cleans up', async () => {
    const app = await fixture();
    const failure = new Error('Electron cannot launch');

    nextSpawnFailure = failure;
    await app.start();

    expect(app.outcome()).toBe(failure);
    expectEverythingReleased(app);
});

it('runs every cleanup when one rejects', async () => {
    const app = await fixture();
    const operational = new Error('reload failed');
    const cleanup = new Error('main close failed');

    app.config.set('mainConfig', () => ({
        configFile: false,
        logLevel: 'silent',
        plugins: [{
            name: 'reject-main-cleanup',
            closeWatcher() {
                events.push('main:closed');

                throw cleanup;
            },
        }],
    }));

    const result = app.start();

    await app.electronLive();
    app.failReload(operational);
    await app.edit('preload', 'failed-reload');
    await result;

    expect(app.outcome()).toBeInstanceOf(AggregateError);
    expect((app.outcome() as AggregateError).errors).toEqual([operational, cleanup]);
    expectEverythingReleased(app);
    expect(events).toContain('electron:stop');
});

it('repeated aborts shut down once', async () => {
    const app = await fixture();
    const result = app.start();

    await app.electronLive();
    app.controller.abort();
    app.controller.abort();
    await result;

    expect(app.outcome()).toBe('stopped');
    expect(count('electron:stop')).toBe(1);
    expect(count('main:closed')).toBe(1);
    expect(count('preload:closed')).toBe(1);
    expect(app.server()?.httpServer?.listening).toBe(false);
});

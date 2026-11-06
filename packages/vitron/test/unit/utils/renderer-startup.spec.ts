import { ChildProcess, spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:http';
import type { ViteDevServer } from 'vite';
import type * as vite from 'vite';
import { getRandomPort } from 'get-port-please';
import {
    afterEach,
    beforeEach,
    expect,
    it,
    vi,
} from 'vitest';
import { createRenderer } from '../../../src/apps/renderer/dev';
import * as processes from '../../../src/apps/renderer/ps';
import { buildConfig } from '../../../src/config/utils/build';

const adapters = vi.hoisted(() => ({ createServer: vi.fn() }));

vi.mock('vite', async (importOriginal) => ({
    ...await importOriginal<typeof vite>(),
    createServer: adapters.createServer,
}));

beforeEach(async () => {
    const actual = await vi.importActual<typeof vite>('vite');

    adapters.createServer.mockImplementation(actual.createServer);
});

afterEach(() => {
    vi.restoreAllMocks();
});

it.each(['127.0.0.1', '::1'])('waits for an external renderer on %s to return a successful response', async (host) => {
    const port = await getRandomPort(host);
    const renderer = createRenderer(buildConfig({ rootPath: process.cwd(), port }));
    let ready = false;
    let requests = 0;
    const server = createServer((_request, response) => {
        requests++;
        response.statusCode = ready ? 200 : 503;
        response.end(ready ? 'renderer ready' : 'renderer starting');
    });

    vi.spyOn(processes, 'spawnRendererProcess').mockReturnValue(new ChildProcess());

    let started = false;
    const startup = renderer.start().then(() => {
        started = true;
    });

    try {
        await new Promise(setImmediate);
        expect(started).toBe(false);

        server.listen(port, host);
        await once(server, 'listening');
        await vi.waitFor(() => expect(requests).toBeGreaterThan(1));
        expect(started).toBe(false);

        ready = true;
        await startup;

        expect(started).toBe(true);
        expect(await (await fetch(`http://localhost:${port}`)).text()).toBe('renderer ready');
    } finally {
        await renderer.stop();

        if (server.listening) {
            await new Promise<void>((resolve, reject) => {
                server.close((error) => (error ? reject(error) : resolve()));
            });
        }
    }
});

it('cleans up an external renderer when readiness fails so startup can retry', async () => {
    const failure = new Error('Renderer startup timed out');
    const renderer = createRenderer(buildConfig({ rootPath: process.cwd(), port: 9000 }));
    const child = new ChildProcess();
    const kill = vi.spyOn(child, 'kill');
    const controller = new AbortController();

    controller.abort(failure);

    vi.spyOn(processes, 'spawnRendererProcess').mockReturnValueOnce(child).mockImplementation(() => new ChildProcess());
    vi.spyOn(AbortSignal, 'timeout').mockReturnValueOnce(controller.signal).mockReturnValue(new AbortController().signal);

    try {
        await expect(renderer.start()).rejects.toThrow('Timed out waiting for the renderer');
        expect(renderer.up()).toBe(false);
        expect(kill).toHaveBeenCalledOnce();

        vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('renderer ready'));
        await renderer.start();
        expect(renderer.up()).toBe(true);
    } finally {
        await renderer.stop();
    }
});

// Real HTTP readiness and a real owned child keep cancellation assertions observable.
async function externalRenderer() {
    const port = await getRandomPort('127.0.0.1');
    let ready = false;
    let requests = 0;
    const server = createServer((_request, response) => {
        requests++;
        response.statusCode = ready ? 200 : 503;
        response.end('renderer');
    });

    server.listen(port, '127.0.0.1');
    await once(server, 'listening');

    const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)']);

    await once(child, 'spawn');

    const exited = () => vi.waitFor(() => {
        expect(child.exitCode !== null || child.signalCode !== null).toBe(true);
    });
    const timeout = new AbortController();

    vi.spyOn(AbortSignal, 'timeout').mockReturnValue(timeout.signal);
    vi.spyOn(processes, 'spawnRendererProcess').mockReturnValue(child);

    const renderer = createRenderer(buildConfig({ rootPath: process.cwd(), port }));

    return {
        renderer,
        child,
        exited,
        ready: () => {
            ready = true;
        },
        requested: () => requests > 0,
        async close() {
            timeout.abort();
            await renderer.stop();
            child.kill();
            await exited();
            server.closeAllConnections();
            await new Promise<void>((resolve, reject) => {
                server.close((error) => (error ? reject(error) : resolve()));
            });
        },
    };
}

it.each(['abort', 'stop'])('cancels external readiness on %s and permits a successful retry', async (action) => {
    const fixture = await externalRenderer();
    const controller = new AbortController();
    let result: unknown;
    const startup = fixture.renderer.start(controller.signal).then(
        () => {
            result = 'started';
        },
        (error) => {
            result = error;
        },
    );

    try {
        await vi.waitFor(() => expect(fixture.requested()).toBe(true));

        if (action === 'abort') {
            controller.abort();
        } else {
            await fixture.renderer.stop();
        }

        await vi.waitFor(() => expect(result).toBeInstanceOf(Error), { timeout: 500 });
        await fixture.exited();
        expect(fixture.renderer.up()).toBe(false);

        fixture.ready();

        const replacement = new ChildProcess();

        vi.mocked(processes.spawnRendererProcess).mockReturnValue(replacement);
        await fixture.renderer.start(new AbortController().signal);
        expect(fixture.renderer.up()).toBe(true);
    } finally {
        await fixture.close();
        await startup;
    }
});

it('waits for a late Vite acquisition to close before stop resolves', async () => {
    const actual = await vi.importActual<typeof vite>('vite');
    let closed = false;
    const server = await actual.createServer({
        configFile: false,
        server: { port: await getRandomPort(), watch: null },
        plugins: [{
            name: 'observe-close',
            closeBundle() {
                closed = true;
            },
        }],
    });
    let acquire!: (server: ViteDevServer) => void;

    adapters.createServer.mockImplementationOnce(() => new Promise<ViteDevServer>((resolve) => {
        acquire = resolve;
    }));
    vi.spyOn(processes, 'spawnRendererProcess').mockReturnValue(undefined);

    const renderer = createRenderer(buildConfig({ rootPath: process.cwd(), port: await getRandomPort() }));
    let result: unknown;
    const startup = renderer.start().catch((error) => {
        result = error;
    });

    try {
        await vi.waitFor(() => expect(acquire).toBeTypeOf('function'));

        let stopped = false;
        const stopping = renderer.stop().then(() => {
            stopped = true;
        });

        await new Promise(setImmediate);
        expect(stopped).toBe(false);
        acquire(server);
        await stopping;
        await startup;
        expect(result).toBeInstanceOf(Error);
        expect(closed).toBe(true);
        expect(server.httpServer?.listening).toBe(false);
        expect(renderer.up()).toBe(false);
    } finally {
        acquire?.(server);
        await startup;
        await renderer.stop();
        await server.close();
    }
});

it('rejects an external child launch error and permits a retry', async () => {
    const fixture = await externalRenderer();
    const child = spawn(`/vitron-missing-renderer-${process.pid}`);

    vi.mocked(processes.spawnRendererProcess).mockReturnValueOnce(child);

    const timeout = new AbortController();

    vi.mocked(AbortSignal.timeout).mockReturnValueOnce(timeout.signal);
    // Observe the fixture error too so the old implementation fails an assertion, not an unhandled event.
    child.on('error', () => {});

    let result: unknown;
    const startup = fixture.renderer.start().catch((error) => {
        result = error;
    });

    try {
        await vi.waitFor(() => expect(result).toMatchObject({ code: 'ENOENT' }), { timeout: 500 });
        expect(fixture.renderer.up()).toBe(false);
        fixture.ready();
        await fixture.renderer.start();
        expect(fixture.renderer.up()).toBe(true);
    } finally {
        timeout.abort();
        await startup;
        await fixture.close();
    }
});

it('repeated stop cancels the same pending external startup', async () => {
    const fixture = await externalRenderer();
    let result: unknown;
    const startup = fixture.renderer.start().catch((error) => {
        result = error;
    });

    try {
        await vi.waitFor(() => expect(fixture.requested()).toBe(true));
        await Promise.all([fixture.renderer.stop(), fixture.renderer.stop(), fixture.renderer.stop()]);
        expect(result).toBeInstanceOf(Error);
        await fixture.exited();
        expect(fixture.renderer.up()).toBe(false);
    } finally {
        await fixture.close();
        await startup;
    }
});

it.each(['abort', 'stop'])('does not restart an external renderer when %s lands in the reload gap', async (action) => {
    const fixture = await externalRenderer();
    const controller = new AbortController();

    fixture.ready();

    try {
        await fixture.renderer.start(controller.signal);

        const reload = fixture.renderer.reload();

        if (action === 'abort') {
            controller.abort();
        } else {
            await fixture.renderer.stop();
        }

        await reload.catch(() => {});
        await fixture.exited();
        expect(fixture.renderer.up()).toBe(false);
    } finally {
        await fixture.close();
    }
});

it('preserves the Vite startup failure when cleanup also fails', async () => {
    const port = await getRandomPort('127.0.0.1');
    const occupied = createServer();

    occupied.listen(port, '127.0.0.1');
    await once(occupied, 'listening');

    const cleanupFailure = new Error('renderer cleanup failed');

    vi.spyOn(processes, 'spawnRendererProcess').mockReturnValue(undefined);

    const renderer = createRenderer(buildConfig({
        rootPath: process.cwd(),
        port,
        rendererConfig(config) {
            config.configFile = false;
            config.server = {
                host: '127.0.0.1',
                strictPort: true,
                watch: null,
            };
            config.plugins = [{
                name: 'fail-cleanup',
                configureServer(server) {
                    const close = server.close.bind(server);

                    server.close = async () => {
                        await close();

                        throw cleanupFailure;
                    };
                },
            }];

            return config;
        },
    }));

    try {
        await expect(renderer.start()).rejects.toMatchObject({ errors: [expect.objectContaining({ message: expect.stringContaining('already in use') }), cleanupFailure] });
        await expect(renderer.stop()).rejects.toBe(cleanupFailure);
        expect(renderer.up()).toBe(false);
    } finally {
        await renderer.stop().catch(() => {});
        await new Promise<void>((resolve, reject) => {
            occupied.close((error) => (error ? reject(error) : resolve()));
        });
    }
});

it.each([false, true])('handles startup queued behind Vite shutdown with later stop=%s', async (stopAgain) => {
    let releaseClose: (() => void) | undefined;
    let delayClose = true;

    vi.spyOn(processes, 'spawnRendererProcess').mockReturnValue(undefined);

    const renderer = createRenderer(buildConfig({
        rootPath: process.cwd(),
        port: await getRandomPort('127.0.0.1'),
        rendererConfig(config) {
            config.configFile = false;
            config.server = {
                host: '127.0.0.1',
                strictPort: true,
                watch: null,
            };
            config.plugins = [{
                name: 'delay-first-close',
                configureServer(server) {
                    const close = server.close.bind(server);

                    server.close = async () => {
                        if (delayClose) {
                            delayClose = false;
                            await new Promise<void>((resolve) => {
                                releaseClose = resolve;
                            });
                        }

                        await close();
                    };
                },
            }];

            return config;
        },
    }));

    try {
        await renderer.start();

        const firstStop = renderer.stop();

        await vi.waitFor(() => expect(releaseClose).toBeTypeOf('function'));

        let result: unknown;
        const queuedStart = renderer.start().then(
            () => {
                result = 'started';
            },
            (error) => {
                result = error;
            },
        );
        const finalStop = stopAgain ? renderer.stop() : undefined;

        releaseClose?.();
        await Promise.all([firstStop, queuedStart, finalStop]);
        expect(renderer.up()).toBe(!stopAgain);

        if (stopAgain) {
            expect(result).toBeInstanceOf(Error);
        } else {
            expect(result).toBe('started');
        }
    } finally {
        releaseClose?.();
        await renderer.stop();
    }
});

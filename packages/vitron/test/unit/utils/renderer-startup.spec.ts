import { ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import fs from 'node:fs/promises';
import { createServer } from 'node:http';
import { createServer as createNetServer } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { getRandomPort } from 'get-port-please';
import type { Plugin } from 'vite';
import {
    afterEach,
    expect,
    it,
    vi,
} from 'vitest';
import { createRenderer } from '../../../src/apps/renderer/dev';
import * as rendererConfig from '../../../src/apps/renderer/config';
import * as processes from '../../../src/apps/renderer/ps';
import { buildConfig } from '../../../src/config/utils/build';

const HOST = '127.0.0.1';

let projects: string[] = [];

afterEach(async () => {
    vi.restoreAllMocks();

    await Promise.all(projects.map((project) => fs.rm(project, { recursive: true, force: true })));
    projects = [];
});

async function createViteRenderer(plugins: Plugin[] = []) {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'vitron-renderer-'));

    projects.push(root);

    vi.spyOn(processes, 'spawnRendererProcess').mockReturnValue(undefined);
    vi.spyOn(rendererConfig, 'buildRendererConfig').mockResolvedValue({
        root,
        configFile: false,
        logLevel: 'silent',
        optimizeDeps: { noDiscovery: true },
        server: { host: HOST, strictPort: true },
        plugins,
    });

    const port = await getRandomPort(HOST);

    return { renderer: createRenderer(buildConfig({ rootPath: root, port })), port };
}

async function bindPort(port: number) {
    const server = createNetServer();

    await new Promise<void>((resolve, reject) => {
        server.once('error', reject);
        server.listen(port, HOST, resolve);
    });

    await new Promise((resolve) => {
        server.close(resolve);
    });
}

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

it('abort during external readiness rejects, kills the child and permits a retry', async () => {
    const renderer = createRenderer(buildConfig({ rootPath: process.cwd(), port: 9000 }));
    const child = new ChildProcess();
    const kill = vi.spyOn(child, 'kill');
    const controller = new AbortController();
    const reason = new Error('cancelled');

    vi.spyOn(processes, 'spawnRendererProcess').mockReturnValueOnce(child).mockImplementation(() => new ChildProcess());

    const fetchMock = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('connection refused'));

    try {
        const startup = renderer.start(controller.signal);

        await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
        controller.abort(reason);

        await expect(startup).rejects.toBe(reason);
        expect(kill).toHaveBeenCalledOnce();
        expect(renderer.up()).toBe(false);

        fetchMock.mockResolvedValueOnce(new Response('renderer ready'));
        await renderer.start();
        expect(renderer.up()).toBe(true);
    } finally {
        await renderer.stop();
    }
});

it('rejects on an external child launch error and permits a retry', async () => {
    const renderer = createRenderer(buildConfig({ rootPath: process.cwd(), port: 9000 }));
    const child = new ChildProcess();
    const kill = vi.spyOn(child, 'kill');
    const launchError = new Error('spawn nuxi ENOENT');

    vi.spyOn(processes, 'spawnRendererProcess').mockReturnValueOnce(child).mockImplementation(() => new ChildProcess());

    const fetchMock = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('connection refused'));

    try {
        const startup = renderer.start();

        await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
        child.emit('error', launchError);

        await expect(startup).rejects.toBe(launchError);
        expect(kill).toHaveBeenCalledOnce();
        expect(renderer.up()).toBe(false);

        fetchMock.mockResolvedValueOnce(new Response('renderer ready'));
        await renderer.start();
        expect(renderer.up()).toBe(true);
    } finally {
        await renderer.stop();
    }
});

it('up is false until external readiness completes', async () => {
    const renderer = createRenderer(buildConfig({ rootPath: process.cwd(), port: 9000 }));

    vi.spyOn(processes, 'spawnRendererProcess').mockReturnValue(new ChildProcess());

    const fetchMock = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('connection refused'));

    try {
        const startup = renderer.start();

        await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
        expect(renderer.up()).toBe(false);

        fetchMock.mockResolvedValue(new Response('renderer ready'));
        await startup;
        expect(renderer.up()).toBe(true);
    } finally {
        await renderer.stop();
    }
});

it('abort after listen closes the Vite server and frees the port', async () => {
    const { renderer, port } = await createViteRenderer();
    const controller = new AbortController();

    try {
        await renderer.start(controller.signal);
        expect(renderer.up()).toBe(true);
        await expect(bindPort(port)).rejects.toMatchObject({ code: 'EADDRINUSE' });

        controller.abort();
        await renderer.stop();

        expect(renderer.up()).toBe(false);
        await expect(bindPort(port)).resolves.toBeUndefined();
    } finally {
        await renderer.stop();
    }
});

it('abort during listen rejects and frees the port', async () => {
    const controller = new AbortController();
    const reason = new Error('cancelled');
    const { renderer, port } = await createViteRenderer([{
        name: 'abort-during-listen',
        buildStart() {
            controller.abort(reason);
        },
    }]);

    try {
        await expect(renderer.start(controller.signal)).rejects.toBe(reason);

        expect(renderer.up()).toBe(false);
        await expect(bindPort(port)).resolves.toBeUndefined();
    } finally {
        await renderer.stop();
    }
});

it('abort releases Vite\'s SIGTERM handler synchronously', async () => {
    const before = process.listenerCount('SIGTERM');
    const { renderer } = await createViteRenderer();
    const controller = new AbortController();

    try {
        await renderer.start(controller.signal);
        expect(process.listenerCount('SIGTERM')).toBe(before + 1);

        controller.abort();
        expect(process.listenerCount('SIGTERM')).toBe(before);
    } finally {
        await renderer.stop();
    }
});

it('abort between external reload stop and start does not restart', async () => {
    const renderer = createRenderer(buildConfig({ rootPath: process.cwd(), port: 9000 }));
    const child = new ChildProcess();
    const controller = new AbortController();
    const reason = new Error('cancelled');
    const spawnMock = vi.spyOn(processes, 'spawnRendererProcess').mockReturnValue(child);

    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response('renderer ready'));
    vi.spyOn(child, 'kill').mockImplementation(() => {
        controller.abort(reason);

        return true;
    });

    try {
        await renderer.start();

        await expect(renderer.reload(controller.signal)).rejects.toBe(reason);
        expect(spawnMock).toHaveBeenCalledOnce();
        expect(renderer.up()).toBe(false);
    } finally {
        await renderer.stop();
    }
});

it('stop is idempotent', async () => {
    const { renderer, port } = await createViteRenderer();

    try {
        await renderer.start();

        await Promise.all([renderer.stop(), renderer.stop()]);
        await renderer.stop();

        expect(renderer.up()).toBe(false);
        await expect(bindPort(port)).resolves.toBeUndefined();
    } finally {
        await renderer.stop();
    }
});

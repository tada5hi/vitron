import { ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { getRandomPort } from 'get-port-please';
import {
    afterEach,
    expect,
    it,
    vi,
} from 'vitest';
import { createRenderer } from '../../../src/apps/renderer/dev';
import * as processes from '../../../src/apps/renderer/ps';
import { buildConfig } from '../../../src/config/utils/build';

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

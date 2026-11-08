/*
 * Copyright (c) 2023.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { ChildProcess } from 'node:child_process';
import { setTimeout } from 'node:timers/promises';
import { createServer } from 'vite';
import type { UserConfig, ViteDevServer } from 'vite';
import type { Config } from '../../config';
import { EnvironmentName } from '../../constants';
import { spawnRendererProcess } from './ps';
import { buildRendererConfig } from './config';

type RendererProcess = {
    start: (signal?: AbortSignal) => Promise<void>,
    stop: () => Promise<void>,
    restart: (signal?: AbortSignal) => Promise<void>
    up: () => boolean,
    reload: (signal?: AbortSignal) => Promise<void>
};

function killProcess(child: ChildProcess) {
    child.removeAllListeners();
    child.kill();
}

export function createRenderer(config: Config) : RendererProcess {
    let myProcess : ChildProcess | undefined;

    let viteConfig : UserConfig | undefined;
    let viteServer: ViteDevServer | undefined;
    let removeAbortListener: (() => void) | undefined;

    const waitForProcess = async (child: ChildProcess, signal?: AbortSignal) : Promise<void> => {
        const url = `http://localhost:${config.get('port')}`;
        const launch = new AbortController();
        const waiting = AbortSignal.any([
            launch.signal,
            AbortSignal.timeout(60_000),
            ...(signal ? [signal] : []),
        ]);
        const onError = (error: Error) => launch.abort(error);

        child.once('error', onError);

        try {
            for (;;) {
                const response = await fetch(url, { signal: waiting }).catch(() => undefined);

                await response?.body?.cancel();

                waiting.throwIfAborted();

                if (response?.ok) {
                    child.off('error', onError);

                    return;
                }

                await setTimeout(100, undefined, { signal: waiting });
            }
        } catch (error) {
            killProcess(child);

            if (signal?.aborted) {
                throw signal.reason;
            }

            if (launch.signal.aborted) {
                throw launch.signal.reason;
            }

            throw new Error(`Timed out waiting for the renderer at ${url}.`, { cause: error });
        }
    };

    const startServer = async (signal?: AbortSignal) : Promise<void> => {
        if (!viteConfig) {
            viteConfig = await buildRendererConfig(config, EnvironmentName.DEVELOPMENT);
        }

        signal?.throwIfAborted();

        const server = await createServer(viteConfig);

        // Closing synchronously on abort releases Vite's SIGTERM callback,
        // which would otherwise call process.exit() mid-cleanup. stop() awaits the same close.
        const closeOnAbort = () => {
            server.close().catch(() => undefined);
        };

        signal?.addEventListener('abort', closeOnAbort, { once: true });

        try {
            signal?.throwIfAborted();
            await server.listen(config.get('port'));
            signal?.throwIfAborted();
        } catch (error) {
            signal?.removeEventListener('abort', closeOnAbort);
            await server.close();

            // Vite skips its HTTP server when closed before binding, and listen() may bind afterwards.
            const { httpServer } = server;

            if (httpServer?.listening) {
                await new Promise((resolve) => {
                    httpServer.close(resolve);
                });
            }

            throw error;
        }

        viteServer = server;
        removeAbortListener = () => signal?.removeEventListener('abort', closeOnAbort);
    };

    const start = async (signal?: AbortSignal) : Promise<void> => {
        if (myProcess || viteServer) {
            return;
        }

        signal?.throwIfAborted();

        const child = spawnRendererProcess(config);

        if (child) {
            await waitForProcess(child, signal);
            myProcess = child;

            return;
        }

        await startServer(signal);
    };

    const stop = async () : Promise<void> => {
        if (myProcess) {
            killProcess(myProcess);

            myProcess = undefined;

            return;
        }

        if (!viteServer) {
            return;
        }

        removeAbortListener?.();

        await viteServer.close();
        viteServer = undefined;
    };

    const restart = async (signal?: AbortSignal) : Promise<void> => {
        if (myProcess) {
            await stop();
            await start(signal);
        }

        if (viteServer) {
            await viteServer.restart();
        }
    };

    const up = () => typeof myProcess !== 'undefined' || typeof viteServer !== 'undefined';

    const reload = async (signal?: AbortSignal) : Promise<void> => {
        if (viteServer) {
            viteServer.ws.send({ type: 'full-reload' });
        } else {
            await restart(signal);
        }
    };

    return {
        restart,
        start,
        stop,
        up,
        reload,
    };
}

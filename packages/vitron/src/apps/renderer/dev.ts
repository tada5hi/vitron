/*
 * Copyright (c) 2023.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { ChildProcess } from 'node:child_process';
import process from 'node:process';
import { setTimeout as delay } from 'node:timers/promises';
import kill from 'tree-kill';
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

type GroupState = 'alive' | 'gone' | 'zombie';

function signalGroup(pid: number, signal: NodeJS.Signals | 0) : GroupState {
    try {
        process.kill(-pid, signal);

        return 'alive';
    } catch (error) {
        const { code } = error as NodeJS.ErrnoException;

        if (code === 'ESRCH') {
            return 'gone';
        }

        // A group kill fails with EPERM only if no member can be signalled, e.g. a group left with an unreaped zombie.
        if (code === 'EPERM') {
            return 'zombie';
        }

        throw error;
    }
}

// Renderer children lead their own process group on POSIX, so a shell launcher's workers are signalled with it.
async function terminateGroup(pid: number) : Promise<void> {
    if (signalGroup(pid, 'SIGTERM') === 'gone') {
        return;
    }

    const deadline = Date.now() + 5000;
    let killed = false;
    let zombies = 0;

    for (;;) {
        await delay(100);

        if (!killed && Date.now() >= deadline) {
            killed = true;
            signalGroup(pid, 'SIGKILL');
        }

        const state = signalGroup(pid, 0);

        if (state === 'gone') {
            return;
        }

        // A zombie is reaped shortly; give up on one that is not.
        zombies = state === 'zombie' ? zombies + 1 : 0;

        if (zombies >= 20) {
            return;
        }
    }
}

function terminateProcess(child: ChildProcess) : Promise<void> {
    const { pid } = child;

    if (!pid) {
        killProcess(child);

        return Promise.resolve();
    }

    if (process.platform !== 'win32') {
        return terminateGroup(pid);
    }

    // With an exit status there is no process to wait for, and `close` may have fired already.
    if (child.exitCode !== null || child.signalCode !== null) {
        killProcess(child);

        return Promise.resolve();
    }

    let timer: ReturnType<typeof setTimeout> | undefined;

    return new Promise<void>((resolve, reject) => {
        child.once('close', () => resolve());
        timer = setTimeout(() => kill(pid, 'SIGKILL'), 5000);

        kill(pid, 'SIGKILL', (error) => {
            if (error) {
                reject(error);
            }
        });
    }).finally(() => clearTimeout(timer));
}

export function createRenderer(config: Config) : RendererProcess {
    let myProcess : ChildProcess | undefined;
    let closing : Promise<void> | undefined;

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
        const onExit = (code: number | null, exitSignal: NodeJS.Signals | null) => {
            const status = code === null ? `signal ${exitSignal}` : `exit code ${code}`;

            launch.abort(new Error(`The renderer process ended before it was ready (${status}).`));
        };
        const ignoreExit = () => {
            child.off('exit', onExit);
            child.off('close', onExit);
        };

        child.once('error', onError);
        child.once('exit', onExit);
        child.once('close', onExit);

        try {
            for (;;) {
                const response = await fetch(url, { signal: waiting }).catch(() => undefined);

                await response?.body?.cancel();

                waiting.throwIfAborted();

                if (response?.ok) {
                    child.off('error', onError);
                    ignoreExit();

                    return;
                }

                await delay(100, undefined, { signal: waiting });
            }
        } catch (error) {
            // The termination's own close must not be reported as an early exit, and a failed kill must not hide the startup error.
            ignoreExit();
            await terminateProcess(child).catch(() => undefined);

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
        if (myProcess || viteServer || closing) {
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
            closing = terminateProcess(myProcess).finally(() => {
                closing = undefined;
            });
            myProcess = undefined;
        }

        if (closing) {
            await closing;

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

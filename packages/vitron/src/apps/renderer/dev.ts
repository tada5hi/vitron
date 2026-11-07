/*
 * Copyright (c) 2023.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { ChildProcess } from 'node:child_process';
import { setTimeout } from 'node:timers/promises';
import { createServer } from 'vite';
import type {
    Plugin,
    ResolvedConfig,
    ServerHook,
    UserConfig,
    ViteDevServer,
} from 'vite';
import type { Config } from '../../config';
import { EnvironmentName } from '../../constants';
import { spawnRendererProcess } from './ps';
import { buildRendererConfig } from './config';

// Plugin objects can be reused by later renderers and ordinary Vite servers.
const wrappedConfigurations = new WeakSet<ServerHook>();
const configurations = new WeakMap<ResolvedConfig, {
    ready: Promise<void>,
    settled: Promise<void>,
    posts: Set<Promise<void>>,
    complete: () => void,
    fail: (error: unknown) => void,
}>();

type RendererProcess = {
    start: (signal?: AbortSignal) => Promise<void>,
    stop: () => Promise<void>,
    restart: () => Promise<void>
    up: () => boolean,
    reload: () => Promise<void>
};
export function createRenderer(config: Config) : RendererProcess {
    let myProcess : ChildProcess | undefined;

    let viteConfig : UserConfig | undefined;
    let viteServer: ViteDevServer | undefined;

    let pendingStart: Promise<void> | undefined;
    let stopping: Promise<void> | undefined;
    let startController: AbortController | undefined;
    let sessionSignal: AbortSignal | undefined;
    let stopVersion = 0;
    let cleaning: Promise<void> | undefined;
    const abortCloses = new Set<Promise<void>>();
    const viteRestarts = new Set<Promise<void>>();
    const restartFailures: unknown[] = [];

    const cleanup = () : Promise<void> => {
        if (!cleaning) {
            startController?.abort();
            cleaning = (async () => {
                // Config restarts can acquire and bind a replacement after cancellation.
                await Promise.allSettled(viteRestarts);

                if (myProcess) {
                    myProcess.removeAllListeners();
                    myProcess.kill();
                    myProcess = undefined;
                }

                if (!viteServer) {
                    return;
                }

                const server = viteServer;

                viteServer = undefined;

                const closed = await Promise.allSettled(new Set([...abortCloses, server.close()]));
                const http = server.httpServer;

                // A pending listen can bind after Vite has cached its close promise.
                if (http?.listening) {
                    closed.push(...await Promise.allSettled([new Promise<void>((resolve, reject) => {
                        http.close((error) => (error ? reject(error) : resolve()));
                    })]));
                }

                const errors = [...new Set([...restartFailures, ...closed.flatMap((result) => (result.status === 'rejected' ? [result.reason] : []))])];

                if (errors.length === 1) {
                    throw errors[0];
                }

                if (errors.length > 1) {
                    throw new AggregateError(errors, 'Renderer cleanup failed.');
                }
            })();
        }

        return cleaning;
    };

    const start = (signal?: AbortSignal) : Promise<void> => {
        if (stopping) {
            const version = stopVersion;

            return stopping.then(() => {
                if (stopVersion !== version) {
                    throw new DOMException('Renderer startup cancelled.', 'AbortError');
                }

                return start(signal);
            });
        }

        if (pendingStart) {
            return pendingStart;
        }

        if (myProcess || viteServer) {
            return Promise.resolve();
        }

        cleaning = undefined;
        abortCloses.clear();
        restartFailures.length = 0;
        sessionSignal = signal;

        const controller = new AbortController();

        startController = controller;

        const cancellation = signal ? AbortSignal.any([signal, controller.signal]) : controller.signal;

        pendingStart = (async () => {
            try {
                cancellation.throwIfAborted();
                myProcess = spawnRendererProcess(config);

                if (myProcess) {
                    const child = myProcess;
                    const url = `http://localhost:${config.get('port')}`;
                    const readiness = AbortSignal.any([cancellation, AbortSignal.timeout(60_000)]);
                    const onError = (error: Error) => controller.abort(error);

                    child.once('error', onError);

                    try {
                        for (;;) {
                            readiness.throwIfAborted();

                            const response = await fetch(url, { signal: readiness }).catch(() => undefined);

                            await response?.body?.cancel();
                            readiness.throwIfAborted();

                            if (response?.ok) {
                                return;
                            }

                            await setTimeout(100, undefined, { signal: readiness });
                        }
                    } catch (error) {
                        cancellation.throwIfAborted();

                        throw new Error(`Timed out waiting for the renderer at ${url}.`, { cause: error });
                    } finally {
                        child.removeListener('error', onError);
                    }
                }

                if (!viteConfig) {
                    viteConfig = await buildRendererConfig(config, EnvironmentName.DEVELOPMENT);
                }

                cancellation.throwIfAborted();
                viteServer = await createServer({
                    ...viteConfig,
                    plugins: [{
                        name: 'vitron-development-lifetime',
                        enforce: 'pre',
                        configResolved(resolved) {
                            // Vite retains this array; replace entries without mutating caller-owned plugins.
                            const plugins = resolved.plugins as Plugin[];
                            const ready = Promise.withResolvers<void>();
                            const posts = new Set<Promise<void>>();
                            let pending = plugins.filter((plugin) => plugin.configureServer).length;
                            const configuration = {
                                ready: ready.promise,
                                settled: ready.promise.catch(async () => {
                                    // A failed post hook cannot release another hook's pending acquisition.
                                    await Promise.allSettled(posts);
                                }),
                                posts,
                                complete: () => {
                                    if (--pending === 0) {
                                        ready.resolve();
                                    }
                                },
                                fail: ready.reject,
                            };

                            configurations.set(resolved, configuration);
                            void ready.promise.catch(() => {});

                            for (const [index, plugin] of plugins.entries()) {
                                const hook = plugin.configureServer;

                                if (!hook) {
                                    continue;
                                }

                                const handler = typeof hook === 'function' ? hook : hook.handler;

                                if (wrappedConfigurations.has(handler)) {
                                    continue;
                                }

                                const configure: ServerHook = async function (server) {
                                    const setup = configurations.get(server.config);

                                    if (!setup) {
                                        return handler.call(this, server);
                                    }

                                    try {
                                        const post = await handler.call(this, server);

                                        if (post) {
                                            return function (this: unknown) {
                                                try {
                                                    const configuring = Promise.resolve(post.call(this));

                                                    setup.posts.add(configuring);
                                                    void configuring.then(setup.complete, setup.fail).finally(() => setup.posts.delete(configuring));
                                                } catch (error) {
                                                    setup.fail(error);

                                                    throw error;
                                                }
                                            };
                                        }

                                        setup.complete();

                                        return undefined;
                                    } catch (error) {
                                        setup.fail(error);

                                        throw error;
                                    }
                                };

                                wrappedConfigurations.add(configure);
                                plugins[index] = {
                                    ...plugin,
                                    configureServer: typeof hook === 'function' ? configure : { ...hook, handler: configure },
                                };
                            }
                        },
                        configureServer: {
                            order: 'pre',
                            handler(server) {
                                viteServer = server;

                                const configuration = configurations.get(server.config)!;
                                const listen = server.listen.bind(server);

                                server.listen = async (...args) => {
                                    await configuration.ready;

                                    return listen(...args);
                                };

                                // Keep plugin cleanup after any resource acquired by a pending configure hook.
                                for (const environment of Object.values(server.environments)) {
                                    const close = environment.close.bind(environment);

                                    environment.close = async () => {
                                        await configuration.settled;
                                        await close();
                                    };
                                }

                                const restartServer = server.restart.bind(server);

                                server.restart = async (...args) => {
                                    if (cancellation.aborted) {
                                        return;
                                    }

                                    const restarting = restartServer(...args);

                                    viteRestarts.add(restarting);

                                    try {
                                        await restarting;
                                    } catch (error) {
                                        restartFailures.push(error);

                                        throw error;
                                    } finally {
                                        viteRestarts.delete(restarting);
                                    }
                                };

                                const closeServer = server.close.bind(server);
                                const close = () => {
                                    // Close synchronously so Vite releases its own forced-exit signal handler.
                                    const closing = server.close();

                                    abortCloses.add(closing);
                                    void closing.catch(() => {});
                                };

                                server.close = () => {
                                    cancellation.removeEventListener('abort', close);

                                    return closeServer();
                                };
                                cancellation.addEventListener('abort', close, { once: true });

                                if (cancellation.aborted) {
                                    close();
                                }
                            },
                        },
                    }, ...viteConfig.plugins || []],
                });
                await configurations.get(viteServer.config)?.ready;
                cancellation.throwIfAborted();
                await viteServer.listen(config.get('port'));
                cancellation.throwIfAborted();
            } catch (error) {
                try {
                    await cleanup();
                } catch (cleanupError) {
                    throw new AggregateError([error, cleanupError], 'Renderer startup and cleanup failed.', { cause: cleanupError });
                }

                throw error;
            } finally {
                pendingStart = undefined;
            }
        })();

        return pendingStart;
    };

    const stop = () : Promise<void> => {
        stopVersion++;
        startController?.abort();

        if (!stopping) {
            const startup = pendingStart;

            stopping = (async () => {
                await startup?.catch(() => {});
                await cleanup();
            })().finally(() => {
                stopping = undefined;
            });
        }

        return stopping;
    };

    const restart = async () : Promise<void> => {
        if (myProcess) {
            const signal = sessionSignal;
            const version = stopVersion + 1;

            await stop();

            if (signal?.aborted || stopVersion !== version) {
                return;
            }

            await start(signal);
        }

        if (viteServer) {
            await viteServer.restart();
        }
    };

    const up = () => typeof myProcess !== 'undefined' || typeof viteServer !== 'undefined';

    const reload = async () : Promise<void> => {
        if (viteServer) {
            viteServer.ws.send({ type: 'full-reload' });
        } else {
            await restart();
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

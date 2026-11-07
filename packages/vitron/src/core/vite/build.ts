/*
 * Copyright (c) 2023.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { build } from 'vite';
import type {
    InlineConfig,
    Logger,
    Plugin,
    Rollup,
} from 'vite';
import type { ViteWatchBuild, ViteWatchHook } from './types';

export function buildWithWatchHook(
    config: InlineConfig,
    watchHook: ViteWatchHook,
): ViteWatchBuild {
    let resolveReady!: () => void;
    let rejectReady!: (error: unknown) => void;
    let watcher: Rollup.RollupWatcher | undefined;
    let closing: Promise<void> | undefined;
    let firstBundle = true;
    let finalization: {
        promise: Promise<void>,
        started: boolean,
        logger: Logger
    } | undefined;
    const cleanupErrors: unknown[] = [];
    let compilation: PromiseWithResolvers<void> | undefined = Promise.withResolvers<void>();
    const ready = new Promise<void>((resolve, reject) => {
        resolveReady = resolve;
        rejectReady = reject;
    });

    // Ownership can be closed without the caller awaiting readiness first.
    void ready.catch(() => {});

    const finalizers: Plugin = {
        name: 'vitron:watch-finalization',
        enforce: 'post',
        options: {
            order: 'post',
            async handler(options) {
                if (!this.meta.watchMode) {
                    return options;
                }

                const completed = Promise.withResolvers<void>();
                const errors: unknown[] = [];
                let pending = 0;

                const bundle = {
                    promise: completed.promise,
                    started: false,
                    logger: this.environment.logger,
                };

                finalization = bundle;
                void bundle.promise.catch(() => {});

                const track = async (input: Rollup.InputPluginOption): Promise<Rollup.InputPluginOption> => {
                    const plugin = await input;

                    if (Array.isArray(plugin)) {
                        return Promise.all(plugin.map(track));
                    }

                    if (!plugin || !plugin.closeBundle) {
                        return plugin;
                    }

                    const hook = plugin.closeBundle;
                    const handler = typeof hook === 'function' ? hook : hook.handler;

                    pending++;

                    return {
                        ...plugin,
                        closeBundle: {
                            ...(typeof hook === 'function' ? {} : hook),
                            async handler(...args) {
                                bundle.started = true;

                                try {
                                    await handler.apply(this, args);
                                } catch (error) {
                                    // Vite discards result.close(); report through our owned event instead.
                                    errors.push(error);
                                } finally {
                                    pending--;

                                    if (pending === 0) {
                                        if (errors.length === 1) {
                                            completed.reject(errors[0]);
                                        } else if (errors.length > 1) {
                                            completed.reject(new AggregateError(errors, 'Bundle finalization failed.'));
                                        } else {
                                            completed.resolve();
                                        }
                                    }
                                }
                            },
                        },
                    };
                };
                const plugins = await track(options.plugins);

                if (pending === 0) {
                    completed.resolve();
                }

                return { ...options, plugins };
            },
        },
    };

    const initializing = build({ ...config, plugins: [...(config.plugins || []), finalizers] }).then((result) => {
        if (!('close' in result)) {
            resolveReady();

            return;
        }

        watcher = result;
        watcher.on('event', async (event) => {
            if (event.code === 'START' || event.code === 'BUNDLE_START') {
                compilation ??= Promise.withResolvers<void>();
            } else if (event.code === 'BUNDLE_END' || event.code === 'ERROR') {
                const bundle = finalization;

                finalization = undefined;

                try {
                    if (event.code === 'ERROR' && event.result) {
                        await event.result.close();
                    }

                    if (bundle && (event.code === 'BUNDLE_END' || bundle.started)) {
                        await bundle.promise;
                    }
                } catch (error) {
                    if (closing) {
                        cleanupErrors.push(error);

                        return;
                    }

                    if (event.code === 'ERROR') {
                        rejectReady(new AggregateError([event.error, error], 'Build and bundle finalization failed.'));
                        bundle?.logger.error(String(error), { error: error instanceof Error ? error : undefined });

                        return;
                    }

                    rejectReady(error);

                    throw error;
                } finally {
                    compilation?.resolve();
                    compilation = undefined;
                }

                if (closing) {
                    return;
                }

                if (event.code === 'ERROR') {
                    rejectReady(event.error);
                } else if (firstBundle) {
                    firstBundle = false;
                    resolveReady();
                } else {
                    await watchHook();
                }
            } else if (event.code === 'END') {
                compilation?.resolve();
                compilation = undefined;
            }
        });
    }, rejectReady);

    return {
        ready,
        close() {
            if (!closing) {
                resolveReady();
                closing = initializing.then(async () => {
                    if (!watcher) {
                        return;
                    }

                    // Finish active hooks before closing, including any build started while awaiting.
                    while (compilation) {
                        await compilation.promise;
                    }

                    try {
                        await watcher.close();
                    } catch (error) {
                        cleanupErrors.push(error);
                    }

                    if (cleanupErrors.length === 1) {
                        throw cleanupErrors[0];
                    }

                    if (cleanupErrors.length > 1) {
                        throw new AggregateError(cleanupErrors, 'Watcher cleanup failed.');
                    }
                });
            }

            return closing;
        },
    };
}

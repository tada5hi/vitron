/*
 * Copyright (c) 2023.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { build } from 'vite';
import type { InlineConfig, Rolldown } from 'vite';
import type { ViteWatchBuild, ViteWatchHook } from './types';

export function buildWithWatchHook(
    config: InlineConfig,
    watchHook: ViteWatchHook,
): ViteWatchBuild {
    let resolveReady!: () => void;
    let rejectReady!: (error: unknown) => void;
    let watcher: Rolldown.RolldownWatcher | undefined;
    let closing: Promise<void> | undefined;
    let firstBundle = true;
    let resolveStarted!: () => void;
    const started = new Promise<void>((resolve) => {
        resolveStarted = resolve;
    });
    const ready = new Promise<void>((resolve, reject) => {
        resolveReady = resolve;
        rejectReady = reject;
    });

    // Ownership can be closed without the caller awaiting readiness first.
    void ready.catch(() => {});

    const initializing = build(config).then((result) => {
        if (!('close' in result)) {
            resolveReady();

            return;
        }

        watcher = result;
        watcher.on('event', async (event) => {
            resolveStarted();

            if (closing) {
                return;
            }

            if (event.code === 'ERROR') {
                rejectReady(event.error);
            } else if (event.code === 'BUNDLE_END') {
                if (firstBundle) {
                    firstBundle = false;
                    resolveReady();
                } else {
                    await watchHook();
                }
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

                    // Rolldown installs native close only after asynchronous option hooks finish.
                    await started;
                    await watcher.close();
                });
            }

            return closing;
        },
    };
}

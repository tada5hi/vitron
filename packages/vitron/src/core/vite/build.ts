/*
 * Copyright (c) 2023.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { build } from 'vite';
import type { InlineConfig, Rollup } from 'vite';
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
    let resolveFirstBuild!: () => void;
    const firstBuild = new Promise<void>((resolve) => {
        resolveFirstBuild = resolve;
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
            if (event.code === 'BUNDLE_END' || event.code === 'ERROR') {
                resolveFirstBuild();
            }

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

                    // Initial hooks must finish before closing their acquired resources.
                    await firstBuild;
                    await watcher.close();
                });
            }

            return closing;
        },
    };
}

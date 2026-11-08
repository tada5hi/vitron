/*
 * Copyright (c) 2023.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { build } from 'vite';
import type { InlineConfig } from 'vite';
import type { RollupWatcher } from 'rollup';
import type { ViteWatchBuild, ViteWatchHook } from './types';

export function buildWithWatchHook(
    config: InlineConfig,
    hook: ViteWatchHook,
): ViteWatchBuild {
    let resolveReady!: () => void;
    let rejectReady!: (error: unknown) => void;
    const ready = new Promise<void>((resolve, reject) => {
        resolveReady = resolve;
        rejectReady = reject;
    });

    // an unawaited rejection must not surface as unhandled
    ready.catch(() => {});

    let closed = false;
    let first = true;
    let watcher: RollupWatcher | undefined;

    const building = build(config).then((result) => {
        if (!config.build?.watch) {
            resolveReady();

            return;
        }

        watcher = result as RollupWatcher;
        watcher.on('event', async (event) => {
            if (closed) {
                return;
            }

            if (event.code === 'BUNDLE_END') {
                if (first) {
                    first = false;
                    resolveReady();
                } else {
                    await hook();
                }
            } else if (event.code === 'ERROR' && first) {
                first = false;
                rejectReady(event.error);
            }
        });
    }, rejectReady);

    let closing: Promise<void> | undefined;

    return {
        ready,
        close: () => {
            closing ??= (async () => {
                closed = true;
                resolveReady();
                await building;
                await watcher?.close();
            })();

            return closing;
        },
    };
}

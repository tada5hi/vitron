/*
 * Copyright (c) 2023.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { merge } from 'smob';
import { build } from 'vite';
import type { InlineConfig } from 'vite';
import type { ViteWatchHook } from './type';

export async function buildWithWatchHook(
    config: InlineConfig,
    watchHook: ViteWatchHook,
) {
    return new Promise<void>((resolve) => {
        if (config.build?.watch) {
            let firstBundle = true;
            const closeBundle = (): void => {
                if (firstBundle) {
                    firstBundle = false;
                    resolve();
                } else {
                    watchHook();
                }
            };

            config = merge(config, {
                plugins: [
                    {
                        name: 'vite:watcher',
                        closeBundle,
                    },
                ],
            } satisfies InlineConfig);
        }

        build(config).then(() => {
            if (!config.build?.watch) {
                resolve();
            }
        });
    });
}

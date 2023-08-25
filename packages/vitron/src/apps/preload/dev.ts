/*
 * Copyright (c) 2023.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { Config } from '../../config';
import { buildWithWatchHook } from '../../core';
import type { ViteWatchHook } from '../../core';
import { buildPreloadConfig } from './config';

export async function startPreloadApp(
    config: Config,
    watchHook: ViteWatchHook,
) {
    const viteConfig = await buildPreloadConfig(config);
    if (!viteConfig) {
        return;
    }

    await buildWithWatchHook(viteConfig, watchHook);
}

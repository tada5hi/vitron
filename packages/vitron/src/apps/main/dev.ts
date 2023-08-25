/*
 * Copyright (c) 2023.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { Config } from '../../config';
import { buildWithWatchHook } from '../../core';
import type { ViteWatchHook } from '../../core';
import { buildMainConfig } from './config';

export async function startMainApp(
    config: Config,
    watchHook: ViteWatchHook,
) {
    const viteConfig = await buildMainConfig(config);

    await buildWithWatchHook(viteConfig, watchHook);
}

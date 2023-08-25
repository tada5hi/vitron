/*
 * Copyright (c) 2023.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { build } from 'vite';
import type { Config } from '../../config';
import { buildPreloadConfig } from './config';

export async function buildPreloadApp(config: Config) {
    const viteConfig = await buildPreloadConfig(config);
    if (!viteConfig) {
        return;
    }

    if (viteConfig.build?.watch) {
        viteConfig.build.watch = null;
    }

    await build(viteConfig);
}

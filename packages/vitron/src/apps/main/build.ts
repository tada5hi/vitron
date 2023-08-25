/*
 * Copyright (c) 2023.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { build } from 'vite';
import type { Config } from '../../config';
import { buildMainConfig } from './config';

export async function buildMainApp(config: Config) {
    const viteConfig = await buildMainConfig(config);
    if (viteConfig.build?.watch) {
        viteConfig.build.watch = null;
    }

    await build(viteConfig);
}

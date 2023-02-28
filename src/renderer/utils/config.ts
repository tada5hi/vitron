/*
 * Copyright (c) 2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { load } from 'locter';
import path from 'node:path';
import { merge } from 'smob';
import type { InlineConfig } from 'vite';
import type { Config } from '../../config';

export async function buildRendererConfig(
    config: Config,
) : Promise<InlineConfig> {
    const packageJson = await load(path.join(config.get('rootPath'), 'package.json'));

    const dependencies : string[] = Object.keys(packageJson.dependencies || {});
    const peerDependencies : string[] = Object.keys(packageJson.peerDependencies || {});

    const inlineConfig : InlineConfig = {
        mode: config.get('env'),
        root: path.join(config.get('rootPath'), config.get('rendererDirectory')),
        build: {
            outDir: 'dist',
            emptyOutDir: false,
            rollupOptions: {
                external: [
                    ...dependencies,
                    ...peerDependencies,

                    // electron dependencies
                    'clipboard',
                    'crash-reporter',
                    'electron',
                    'ipc',
                    'native-image',
                    'original-fs',
                    'screen',
                    'shell',

                    // electron renderer
                    'desktop-capturer',
                    'ipc-renderer',
                    'remote',
                    'web-frame',
                ],
            },
        },
    };

    if (config.has('rendererConfig')) {
        merge(inlineConfig, config.get('rendererConfig')(inlineConfig));
    }

    return inlineConfig;
}

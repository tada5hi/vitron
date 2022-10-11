/*
 * Copyright (c) 2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import path from 'path';
import { merge } from 'smob';
import { InlineConfig } from 'vite';
import { useElectronAdapterConfig } from '../../config';
import { Environment } from '../../constants';
import { Config } from '../../type';

export function buildRendererConfig(
    env: `${Environment}`,
    config?: string | Config,
) : InlineConfig {
    if (typeof config === 'string' || typeof config === 'undefined') {
        config = useElectronAdapterConfig(config || process.cwd());
    }

    // eslint-disable-next-line @typescript-eslint/no-var-requires,global-require,import/no-dynamic-require
    const packageJson = require(path.join(config.rootPath, 'package.json'));

    const dependencies : string[] = Object.keys(packageJson.dependencies || {});
    const peerDependencies : string[] = Object.keys(packageJson.peerDependencies || {});

    const inlineConfig : InlineConfig = {
        mode: env,
        root: path.join(config.rootPath, config.rendererDirectory),
        build: {
            outDir: 'dist',
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

    if (config.rendererConfig) {
        merge(config.rendererConfig(inlineConfig), inlineConfig);
    }

    return inlineConfig;
}

/*
 * Copyright (c) 2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import path from 'path';
import { merge } from 'smob';
import { InlineConfig } from 'vite';
import { useConfig } from '../../config';
import { Environment } from '../../constants';
import { Config } from '../../type';
import { getNodeBuiltInModules } from './node-builtin';

export function buildEntryPointConfig(
    env: `${Environment}`,
    config?: string | Config,
) : InlineConfig {
    if (typeof config === 'string' || typeof config === 'undefined') {
        config = useConfig(config || process.cwd());
    }

    // eslint-disable-next-line @typescript-eslint/no-var-requires,global-require,import/no-dynamic-require
    const packageJson = require(path.join(config.rootPath, 'package.json'));

    const dependencies : string[] = Object.keys(packageJson.dependencies || {});
    const peerDependencies : string[] = Object.keys(packageJson.peerDependencies || {});

    const inlineConfig : InlineConfig = {
        mode: env,
        root: path.join(config.rootPath, config.entrypointDirectory),
        build: {
            emptyOutDir: false,
            manifest: true,
            target: 'es6',
            outDir: 'dist',
            lib: {
                entry: path.join(config.rootPath, config.entrypointDirectory, 'index.ts'),
                fileName: 'index',
                formats: ['cjs'],
            },
            rollupOptions: {
                input: path.join(config.rootPath, config.entrypointDirectory, 'index.ts'),
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

                    // electron-main dependencies
                    'app',
                    'auto-updater',
                    'browser-window',
                    'content-tracing',
                    'dialog',
                    'global-shortcut',
                    'ipc-main',
                    'menu',
                    'menu-item',
                    'power-monitor',
                    'power-save-blocker',
                    'protocol',
                    'session',
                    'tray',
                    'web-contents',

                    // node built-in internals
                    ...getNodeBuiltInModules(),
                ],
            },
        },
        server: {

        },
    };

    if (config.entrypointConfig) {
        merge(config.entrypointConfig(inlineConfig), inlineConfig);
    }

    return inlineConfig;
}

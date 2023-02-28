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
import { getNodeBuiltInModules } from './node-builtin';

export async function buildEntryPointConfig(
    config: Config,
) : Promise<InlineConfig> {
    const packageJson = await load(path.join(config.get('rootPath'), 'package.json'));

    const dependencies : string[] = Object.keys(packageJson.dependencies || {});
    const peerDependencies : string[] = Object.keys(packageJson.peerDependencies || {});

    const inlineConfig : InlineConfig = {
        mode: config.get('env'),
        root: path.join(config.get('rootPath'), config.get('entrypointDirectory')),
        define: {
            'process.env.NODE_ENV': `"${config.get('env')}"`,
            'process.env.PORT': `"${config.get('port')}"`,
        },
        build: {
            emptyOutDir: false,
            manifest: true,
            target: 'es6',
            outDir: 'dist',
            lib: {
                entry: path.join(config.get('rootPath'), config.get('entrypointDirectory'), 'index.ts'),
                fileName: 'index',
                formats: ['cjs'],
            },
            rollupOptions: {
                input: path.join(config.get('rootPath'), config.get('entrypointDirectory'), 'index.ts'),
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

    if (config.has('entrypointConfig')) {
        merge(config.get('entrypointConfig')(inlineConfig), inlineConfig);
    }

    return inlineConfig;
}

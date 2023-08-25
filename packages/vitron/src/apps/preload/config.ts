/*
 * Copyright (c) 2022-2023.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import path from 'node:path';
import { load } from 'locter';
import { merge } from 'smob';
import type { InlineConfig } from 'vite';
import type { Config } from '../../config';
import {
    findEntryFile,
    getElectronDependencies,
    getElectronMainDependencies,
    getNodeBuiltInModules,
} from '../../utils';
import { AppName } from '../constants';
import { getAppDestinationDirectoryPath, getAppDirectoryPath } from '../utils';

export async function buildPreloadConfig(
    config: Config,
) : Promise<InlineConfig | undefined> {
    const packageJson = await load(path.join(config.get('rootPath'), 'package.json'));

    const dependencies : string[] = Object.keys(packageJson.dependencies || {});
    const peerDependencies : string[] = Object.keys(packageJson.peerDependencies || {});

    const entryFile = await findEntryFile(path.join(config.get('rootPath'), config.get('preloadDirectory')));
    if (!entryFile) {
        return undefined;
    }

    const inlineConfig : InlineConfig = {
        mode: config.get('env'),
        root: getAppDirectoryPath(config, AppName.PRELOAD),
        define: {
            'process.env.NODE_ENV': `"${config.get('env')}"`,
            'process.env.PORT': `"${config.get('port')}"`,
        },
        optimizeDeps: {
            esbuildOptions: {
                target: 'es2020',
            },
        },
        build: {
            watch: {},
            emptyOutDir: true,
            manifest: true,
            target: 'es2020',
            outDir: getAppDestinationDirectoryPath(config, AppName.PRELOAD),
            lib: {
                entry: entryFile,
                fileName: 'index',
                formats: ['cjs'],
            },
            rollupOptions: {
                input: entryFile,
                external: [
                    ...dependencies,
                    ...peerDependencies,

                    // electron dependencies
                    ...getElectronDependencies(),
                    ...getElectronMainDependencies(),

                    // node built-in internals
                    ...getNodeBuiltInModules(),
                ],
            },
        },
    };

    const customConfig = config.get('preloadConfig');
    if (customConfig) {
        return merge(customConfig(inlineConfig), inlineConfig);
    }

    return inlineConfig;
}

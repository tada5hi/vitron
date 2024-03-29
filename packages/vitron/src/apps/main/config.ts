/*
 * Copyright (c) 2022-2023.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import path from 'node:path';
import replace from '@rollup/plugin-replace';
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

export async function buildMainConfig(
    config: Config,
) : Promise<InlineConfig> {
    const packageJson = await load(path.join(config.get('rootPath'), 'package.json'));

    const dependencies : string[] = Object.keys(packageJson.dependencies || {});
    const peerDependencies : string[] = Object.keys(packageJson.peerDependencies || {});

    const entryFile = await findEntryFile(path.join(config.get('rootPath'), config.get('mainDirectory')));
    if (!entryFile) {
        throw new Error('The main entrypoint file could not be located...');
    }

    const inlineConfig : InlineConfig = {
        mode: config.get('env'),
        root: getAppDirectoryPath(config, AppName.MAIN),
        define: {
            NODE_ENV: `"${config.get('env')}"`,
            PORT: `"${config.get('port')}"`,
        },
        optimizeDeps: {
            esbuildOptions: {
                target: 'es2020',
            },
        },
        build: {
            watch: {},
            emptyOutDir: false,
            manifest: true,
            target: 'es2020',
            outDir: getAppDestinationDirectoryPath(config, AppName.MAIN),
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

                plugins: [
                    replace({
                        preventAssignment: true,
                        uncrypto: 'crypto',
                        'process.env.NODE_ENV': `"${config.get('env')}"`,
                        'process.env.PORT': `"${config.get('port')}"`,
                    }),
                ],
            },
        },
        server: {

        },
    };

    const customConfig = config.get('mainConfig');
    if (customConfig) {
        return merge(customConfig(inlineConfig), inlineConfig);
    }

    return inlineConfig;
}

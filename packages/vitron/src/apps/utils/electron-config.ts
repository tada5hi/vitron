/*
 * Copyright (c) 2022-2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import path from 'node:path';
import { read } from 'locter';
import type { InlineConfig } from 'vite';
import type { Config } from '../../config';
import {
    findEntryFile,
    getElectronDependencies,
    getElectronMainDependencies,
    getNodeBuiltInModules,
} from '../../utils';
import { AppName } from '../constants';
import { getAppDestinationDirectoryPath, getAppDirectoryPath } from './directory';

/**
 * Build policy shared by the main and preload applications.
 * Returns undefined if the application has no entry file.
 */
export async function buildElectronConfig(
    config: Config,
    app: AppName.MAIN | AppName.PRELOAD,
) : Promise<InlineConfig | undefined> {
    const packageJson = await read(path.join(config.get('rootPath'), 'package.json'));

    const dependencies : string[] = Object.keys(packageJson.dependencies || {});
    const peerDependencies : string[] = Object.keys(packageJson.peerDependencies || {});

    const directory = app === AppName.MAIN ?
        config.get('mainDirectory') :
        config.get('preloadDirectory');
    const entryFile = await findEntryFile(path.join(config.get('rootPath'), directory));

    if (!entryFile) {
        return undefined;
    }

    return {
        mode: config.get('env'),
        root: getAppDirectoryPath(config, app),
        optimizeDeps: { rolldownOptions: { transform: { target: 'es2020' } } },
        build: {
            watch: {},
            manifest: true,
            target: 'es2020',
            outDir: getAppDestinationDirectoryPath(config, app),
            lib: {
                entry: entryFile,
                fileName: 'index',
                formats: ['cjs'],
            },
            rolldownOptions: {
                input: entryFile,
                // Vite targets client builds at the browser, which leaves import.meta.url undefined in CommonJS output.
                platform: 'node',
                // Rolldown's default omits the directive, which would run CommonJS output in sloppy mode.
                output: { strict: true },
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
}

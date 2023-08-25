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
import type { EnvironmentName } from '../../constants';
import { getElectronDependencies, getElectronRendererDependencies } from '../../utils';
import { AppName } from '../constants';
import { getAppDestinationDirectoryPath, getAppDirectoryPath } from '../utils';

export async function buildRendererConfig(
    config: Config,
    env: `${EnvironmentName}`,
) : Promise<InlineConfig> {
    const packageJson = await load(path.join(config.get('rootPath'), 'package.json'));

    const dependencies : string[] = Object.keys(packageJson.dependencies || {});
    const peerDependencies : string[] = Object.keys(packageJson.peerDependencies || {});

    const inlineConfig : InlineConfig = {
        mode: env || config.get('env'),
        root: getAppDirectoryPath(config, AppName.RENDERER),
        build: {
            emptyOutDir: false,
            outDir: getAppDestinationDirectoryPath(config, AppName.RENDERER),
            rollupOptions: {
                external: [
                    ...dependencies,
                    ...peerDependencies,

                    ...getElectronDependencies(),
                    ...getElectronRendererDependencies(),
                ],
            },
        },
    };

    if (config.has('rendererConfig')) {
        merge(inlineConfig, config.get('rendererConfig')(inlineConfig));
    }

    return inlineConfig;
}

/*
 * Copyright (c) 2023-2023.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import fs from 'node:fs';
import path from 'node:path';
import type { Config } from '../../config';
import { ensureDirectoryExists } from '../../utils';
import { AppName } from '../constants';
import { getAppDirectoryPath } from '../utils';

export async function moveAppRendererDirectory(
    config: Config,
) {
    const destinationBasePath = path.resolve(config.get('rootPath'), config.get('buildDirectory'));
    await ensureDirectoryExists(destinationBasePath);

    const sourcePath = getAppDirectoryPath(config, AppName.RENDERER);
    const sourceDistPath = path.join(sourcePath, config.get('rendererBuildDirectory'));

    const destinationPath = path.join(destinationBasePath, AppName.RENDERER);

    try {
        await fs.promises.access(destinationPath, fs.constants.R_OK);
        await fs.promises.rm(destinationPath, { recursive: true });
    } catch (e) {
        //
    }

    fs.cpSync(
        sourceDistPath,
        destinationPath + path.sep,
        { dereference: true, recursive: true },
    );
}

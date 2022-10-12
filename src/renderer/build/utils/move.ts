/*
 * Copyright (c) 2021.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import path from 'path';
import fs from 'fs-extra';
import { Config } from '../../../type';

export async function moveRendererBuildDirectory(config: Config) : Promise<void> {
    const directoryPath = path.join(config.rootPath, config.rendererDirectory);

    const buildDirectories: string[] = Array.isArray(config.rendererBuildPath) ?
        config.rendererBuildPath :
        [config.rendererBuildPath];

    const isSingle = buildDirectories.length === 1;

    const promises : Promise<void>[] = [];

    for (let i = 0; i < buildDirectories.length; i++) {
        let destinationPath = path.join(config.rootPath, config.entrypointDirectory, 'dist');

        if (!isSingle) {
            const sourceFolderName = buildDirectories[i].split(path.sep).pop();
            destinationPath = path.join(destinationPath, sourceFolderName);
        }

        const promise = fs.copy(
            path.join(directoryPath, buildDirectories[i]),
            destinationPath,
        );

        promises.push(promise);
    }

    await Promise.all(promises);
}

/*
 * Copyright (c) 2021.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import path from 'node:path';
import fs from 'node:fs';
import type { Config } from '../../../config';

export async function moveRendererBuildDirectory(config: Config) : Promise<void> {
    const directoryPath = path.join(config.get('rootPath'), config.get('rendererDirectory'));

    const buildDirectories: string[] = config.get('rendererBuildDirectory');

    const promises : Promise<void>[] = [];

    for (let i = 0; i < buildDirectories.length; i++) {
        let destinationPath = path.join(config.get('rootPath'), config.get('entrypointDirectory'), 'dist');

        if (buildDirectories.length > 1) {
            const sourceFolderName = buildDirectories[i].split(path.sep).pop();
            destinationPath = path.join(destinationPath, sourceFolderName);
        }

        const promise = fs.promises.cp(
            path.join(directoryPath, buildDirectories[i]),
            destinationPath,
            { recursive: true },
        );

        promises.push(promise);
    }

    await Promise.all(promises);
}

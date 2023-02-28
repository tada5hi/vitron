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
    const sourceBasePath = path.join(config.get('rootPath'), config.get('rendererDirectory'));
    const destinationBasePath = path.join(config.get('rootPath'), config.get('entrypointDirectory'));

    const buildDirectories: string[] = config.get('rendererBuildDirectory');

    const promises : Promise<void>[] = [];

    for (let i = 0; i < buildDirectories.length; i++) {
        let destinationPath = path.resolve(destinationBasePath, 'dist');

        if (buildDirectories.length > 1) {
            const sourceFolderName = path.basename(buildDirectories[i]);
            destinationPath = path.join(destinationPath, sourceFolderName);
        }

        const sourcePath = path.resolve(sourceBasePath, buildDirectories[i]);

        const promise = fs.promises.cp(
            sourcePath,
            destinationPath,
            { recursive: true },
        );

        promises.push(promise);
    }

    await Promise.all(promises);
}

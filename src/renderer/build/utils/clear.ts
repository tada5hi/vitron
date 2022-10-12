/*
 * Copyright (c) 2021.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import path from 'path';
import fs from 'fs';
import { Config } from '../../../type';

export async function clearRendererBuilds(config: Config) : Promise<void[]> {
    const rendererDirectoryPath = path.join(config.rootPath, config.rendererDirectory);

    const buildDirectories: string[] = [
        ...(Array.isArray(config.rendererBuildPath) ? config.rendererBuildPath : [config.rendererBuildPath]),
    ];

    const promises : Promise<void>[] = [];

    for (let i = 0; i < buildDirectories.length; i++) {
        if (!path.isAbsolute(buildDirectories[i])) {
            buildDirectories[i] = path.join(rendererDirectoryPath, buildDirectories[i]);
        }

        const promise = fs.promises.rm(buildDirectories[i], { recursive: true, force: true });

        promises.push(promise);
    }

    return Promise.all(promises);
}

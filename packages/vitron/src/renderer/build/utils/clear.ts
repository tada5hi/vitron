/*
 * Copyright (c) 2021.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import path from 'node:path';
import fs from 'node:fs';
import type { Config } from '../../../config';

export async function clearRendererBuilds(config: Config) : Promise<void[]> {
    const rendererDirectoryPath = path.join(config.get('rootPath'), config.get('rendererDirectory'));

    const buildDirectories: string[] = config.get('rendererBuildDirectory');

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

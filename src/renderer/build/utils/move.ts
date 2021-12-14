/*
 * Copyright (c) 2021.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import path from 'path';
import fs from 'fs-extra';
import { Config } from '../../../type';

export function moveRendererBuildDirectory(config: Config) {
    const renderDirectoryPath = path.join(config.rootPath, config.rendererDirectory);

    const rendererBuildDirectories: string[] = [];

    if (config.rendererBuildPaths) {
        rendererBuildDirectories.push(...config.rendererBuildPaths);
    }

    if (rendererBuildDirectories.length === 0) {
        if (config.framework) {
            switch (config.framework) {
                case 'nuxt':
                case 'next':
                    rendererBuildDirectories.push('dist');
                    break;
            }
        }
    }

    if (rendererBuildDirectories.length > 0) {
        const isSingle = rendererBuildDirectories.length === 1;

        for (let i = 0; i < rendererBuildDirectories.length; i++) {
            let destinationPath = path.join(config.rootPath, config.buildTempDirectory);
            if (!isSingle) {
                const sourceFolderName = rendererBuildDirectories[i].split(path.sep).pop();
                destinationPath = path.join(destinationPath, sourceFolderName);
            }

            fs.copySync(
                path.join(renderDirectoryPath, rendererBuildDirectories[i]),
                destinationPath,
            );
        }
    } else {
        const destinationPath = path.join(config.rootPath, config.buildTempDirectory);

        const rendererDistPath = path.join(renderDirectoryPath, 'dist');
        if (fs.existsSync(rendererDistPath)) {
            fs.copySync(
                path.join(rendererDistPath),
                destinationPath,
            );
        } else {
            fs.copySync(
                renderDirectoryPath,
                destinationPath,
            );
        }
    }
}

/*
 * Copyright (c) 2021.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import path from 'path';
import { Config } from '../../type';
import { detectFramework } from '../../utils/framework-detect';

export function extendElectronAdapterConfig(config: Config, directoryPath: string): Config {
    if (config.rootPath) {
        if (!path.isAbsolute(config.rootPath)) {
            config.rootPath = path.join(directoryPath, config.rootPath);
        }
    } else {
        config.rootPath = directoryPath;
    }

    if (!config.buildDirectory) {
        config.buildDirectory = 'dist';
    }

    if (!config.buildTempDirectory) {
        config.buildTempDirectory = '.electron-adapter';
    }

    if (!config.rendererDirectory) {
        config.rendererDirectory = 'renderer';
    }

    if (!config.mainDirectory) {
        config.mainDirectory = 'main';
    }

    if (!config.framework) {
        config.framework = detectFramework(config);
    }

    return config;
}

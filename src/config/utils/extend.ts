/*
 * Copyright (c) 2021.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import path from 'path';
import { Config } from '../../type';
import { detectFramework } from '../../utils';

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

    if (!config.rendererDirectory) {
        config.rendererDirectory = 'src';
    }

    if (!config.entrypointDirectory) {
        config.entrypointDirectory = 'entrypoint';
    }

    if (!config.framework) {
        config.framework = detectFramework(config);
    }

    if (!config.port) {
        config.port = 9000;
    }

    return config;
}

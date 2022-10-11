/*
 * Copyright (c) 2021.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import path from 'path';
import { Config } from '../../type';
import { detectFramework } from '../../utils';
import { ConfigDefault } from '../constants';

export function extendConfig(config: Config, directoryPath: string): Config {
    if (config.rootPath) {
        if (!path.isAbsolute(config.rootPath)) {
            config.rootPath = path.join(directoryPath, config.rootPath);
        }
    } else {
        config.rootPath = directoryPath;
    }

    if (!config.buildDirectory) {
        config.buildDirectory = ConfigDefault.BUILD_DIRECTORY;
    }
    config.buildDirectory = config.buildDirectory.replace(/\//g, path.sep);

    if (!config.rendererDirectory) {
        config.rendererDirectory = ConfigDefault.RENDERER_DIRECTORY;
    }
    config.rendererDirectory = config.rendererDirectory.replace(/\//g, path.sep);

    if (!config.entrypointDirectory) {
        config.entrypointDirectory = ConfigDefault.ENTRYPOINT_DIRECTORY;
    }
    config.entrypointDirectory = config.entrypointDirectory.replace(/\//g, path.sep);

    if (!config.framework) {
        config.framework = detectFramework(config);
    }

    if (!config.port) {
        config.port = ConfigDefault.PORT;
    }

    if (!config.npmClient) {
        config.npmClient = ConfigDefault.NPM_CLIENT;
    }

    return config;
}

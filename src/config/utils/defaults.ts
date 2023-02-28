/*
 * Copyright (c) 2021.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import path from 'node:path';
import type { Config } from '../../type';
import { guessFramework, isValidFramework } from '../../utils';

export function extendConfigWithDefaults(config: Partial<Config>): Config {
    if (!config.port) {
        config.port = 9000;
    }

    if (!isValidFramework(config.framework)) {
        config.framework = guessFramework(config.rootPath);
    }

    if (config.rootPath) {
        if (!path.isAbsolute(config.rootPath)) {
            config.rootPath = path.join(process.cwd(), config.rootPath);
        }
    } else {
        config.rootPath = process.cwd();
    }

    // ----------------------------------------

    if (!config.buildDirectory) {
        config.buildDirectory = 'dist';
    }
    config.buildDirectory = config.buildDirectory.replace(/\//g, path.sep);

    // ----------------------------------------

    if (!config.rendererDirectory) {
        config.rendererDirectory = 'src/renderer';
    }
    config.rendererDirectory = config.rendererDirectory.replace(/\//g, path.sep);

    if (!config.rendererBuildDirectory) {
        config.rendererBuildDirectory = ['dist'];
    }

    // ----------------------------------------

    if (!config.entrypointDirectory) {
        config.entrypointDirectory = 'src/entrypoint';
    }
    config.entrypointDirectory = config.entrypointDirectory.replace(/\//g, path.sep);

    return config as Config;
}

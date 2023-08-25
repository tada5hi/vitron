/*
 * Copyright (c) 2023.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import path from 'node:path';
import type { Config } from '../../config';
import { ensureDirectoryExists, ensureDirectoryNotExists } from '../../utils';
import { AppName } from '../constants';

export function getAppDirectoryPath(config: Config, app: `${AppName}`) {
    let directoryPath : string;

    switch (app) {
        case AppName.ENTRYPOINT: {
            directoryPath = path.resolve(config.get('rootPath'), config.get('entrypointDirectory'));
            break;
        }
        case AppName.PRELOAD: {
            directoryPath = path.resolve(config.get('rootPath'), config.get('preloadDirectory'));
            break;
        }
        default: {
            directoryPath = path.resolve(config.get('rootPath'), config.get('rendererDirectory'));
            break;
        }
    }

    return directoryPath;
}

export function getAppDestinationDirectoryPath(config: Config, app: `${AppName}`) {
    return path.join(config.get('rootPath'), config.get('buildDirectory'), app);
}

export function getBuildDirectoryPath(config: Config) {
    return path.resolve(config.get('rootPath'), config.get('buildDirectory'));
}

export async function clearBuildDirectory(config: Config) {
    const entrypointDistDirectory = path.join(config.get('rootPath'), config.get('buildDirectory'));
    await ensureDirectoryNotExists(entrypointDistDirectory);
}

export async function createBuildDirectory(config: Config) {
    const buildDirectory = path.join(config.get('rootPath'), config.get('buildDirectory'));
    await ensureDirectoryExists(buildDirectory);
}

/*
 * Copyright (c) 2021.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import path from 'path';
import { SpawnSyncOptions, spawn, spawnSync } from 'child_process';
import { Config } from '../../type';
import { moveRendererBuildDirectory } from './utils';

export function runRendererBuildCommand(config: Config): void {
    const renderDirectoryPath = path.join(config.rootPath, config.rendererDirectory);

    const execOptions: SpawnSyncOptions = {
        cwd: config.rootPath,
        stdio: 'inherit',
    };

    if (config.rendererBuildCommands) {
        config.rendererBuildCommands({
            env: 'production',
            rootPath: config.rootPath,
            exec: spawn,
            execSync: spawnSync,
            execOptions,
        });
    }
    if (config.framework) {
        switch (config.framework) {
            case 'nuxt':
                spawnSync('nuxt', ['build', renderDirectoryPath], execOptions);
                spawnSync('nuxt', ['generate', renderDirectoryPath], execOptions);
                break;
            case 'next':
                spawnSync('next', ['build', renderDirectoryPath], execOptions);
                spawnSync('next', ['export', '-o', path.join(config.rootPath, config.buildTempDirectory), renderDirectoryPath], execOptions);
                break;
        }
    } else {
        // todo: build static files in renderer/dist or renderer folder.
    }

    moveRendererBuildDirectory(config);
}

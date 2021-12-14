/*
 * Copyright (c) 2021.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import {
    ChildProcessWithoutNullStreams, SpawnSyncOptions, spawn, spawnSync,
} from 'child_process';
import path from 'path';
import { Config } from '../../type';

export function runRendererDevCommand(config: Config): ChildProcessWithoutNullStreams | undefined {
    const renderDirectoryPath = path.join(config.rootPath, config.rendererDirectory);

    const execOptions: SpawnSyncOptions = {
        cwd: config.rootPath,
        stdio: 'inherit',
    };

    if (config.rendererDevCommands) {
        return config.rendererDevCommands({
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
                return spawn('nuxt', ['-p', config.port.toString(), renderDirectoryPath], execOptions);
            case 'next':
                return spawn('next', ['-p', config.port.toString(), renderDirectoryPath], execOptions);
        }
    } else {
        // todo: serve static files in renderer/dist or renderer folder.
    }

    return undefined;
}

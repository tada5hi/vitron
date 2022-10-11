/*
 * Copyright (c) 2021.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import path from 'path';
import spawn from 'cross-spawn';
import { SpawnOptions } from 'child_process';
import { Config } from '../../type';
import { moveRendererBuildDirectory } from './utils';

export function runRendererBuildCommand(config: Config): void {
    const renderDirectoryPath = path.join(config.rootPath, config.rendererDirectory);

    const execOptions: SpawnOptions = {
        cwd: config.rootPath,
        stdio: 'inherit',
        detached: false,
    };

    if (config.rendererBuildCommands) {
        config.rendererBuildCommands({
            env: 'production',
            rootPath: config.rootPath,
            exec: spawn,
            execSync: spawn.sync,
            execOptions,
        });
    }

    if (config.framework) {
        switch (config.framework) {
            case 'nuxt':
                spawn.sync('nuxt', ['build', renderDirectoryPath], execOptions);
                spawn.sync('nuxt', ['generate', renderDirectoryPath], execOptions);
                break;
            case 'next':
                spawn.sync('next', ['build', renderDirectoryPath], execOptions);
                spawn.sync('next', ['export', '-o', path.join(config.rootPath, config.entrypointDirectory, 'dist'), renderDirectoryPath], execOptions);
                break;
        }
    } else {
        spawn.sync('vitron', ['vite', '--cmd', 'build', '--root', config.rootPath], execOptions);
    }

    moveRendererBuildDirectory(config);
}

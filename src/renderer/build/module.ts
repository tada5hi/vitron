/*
 * Copyright (c) 2021.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import path from 'node:path';
import spawn from 'cross-spawn';
import type { SpawnOptions } from 'node:child_process';
import { Framework } from '../../constants';
import type { Config } from '../../type';
import { moveRendererBuildDirectory } from './utils';

export async function runRendererBuildCommand(config: Config): Promise<void> {
    const renderDirectoryPath = path.join(config.rootPath, config.rendererDirectory);

    const execOptions: SpawnOptions = {
        cwd: config.rootPath,
        stdio: 'inherit',
        detached: false,
    };

    if (config.rendererBuildCommand) {
        config.rendererBuildCommand({
            config,

            exec: spawn.sync,
            execOptions,
        });
    } else {
        switch (config.framework) {
            case Framework.NUXT: {
                spawn.sync('nuxt', ['build', renderDirectoryPath], execOptions);
                spawn.sync('nuxt', ['generate', renderDirectoryPath], execOptions);
                break;
            }
            case Framework.NEXT: {
                spawn.sync('next', ['build', renderDirectoryPath], execOptions);
                spawn.sync('next', ['export', '-o', path.join(renderDirectoryPath, 'dist')], execOptions);
                break;
            }
            default: {
                spawn.sync('vitron', ['vite', '--cmd', 'build', '--root', config.rootPath], execOptions);
                break;
            }
        }
    }

    await moveRendererBuildDirectory(config);
}

/*
 * Copyright (c) 2021.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import spawn from 'cross-spawn';
import { ChildProcess, SpawnSyncOptions } from 'child_process';
import { Config } from '../../type';

export function runRendererDevCommand(config: Config): ChildProcess | undefined {
    const execOptions: SpawnSyncOptions = {
        cwd: config.rootPath,
        stdio: 'inherit',
    };

    if (config.rendererDevCommands) {
        return config.rendererDevCommands({
            env: 'production',
            rootPath: config.rootPath,
            exec: spawn,
            execSync: spawn.sync,
            execOptions,
        });
    }
    if (config.framework) {
        switch (config.framework) {
            case 'nuxt': {
                return spawn('nuxt', ['-p', config.port.toString(), config.rendererDirectory], execOptions);
            }
            case 'next':
                return spawn('next', ['-p', config.port.toString(), config.rendererDirectory], execOptions);
        }
    } else {
        return spawn('electron-adapter', ['webpack', '--cmd', 'dev'], execOptions);
    }

    return undefined;
}

/*
 * Copyright (c) 2021.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import spawn from 'cross-spawn';
import { ChildProcess, SpawnOptions } from 'child_process';
import { Config } from '../../type';

export function runRendererDevCommand(config: Config): ChildProcess | undefined {
    const execOptions: SpawnOptions = {
        cwd: config.rootPath,
        stdio: 'inherit',
        detached: false,
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
    }

    return spawn('vitron', ['static', '--cmd', 'dev'], execOptions);
}

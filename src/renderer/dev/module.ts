/*
 * Copyright (c) 2021.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import spawn from 'cross-spawn';
import type { ChildProcess, SpawnOptions } from 'child_process';
import { Framework } from '../../constants';
import type { Config } from '../../type';

export function runRendererDevCommand(config: Config): ChildProcess {
    const execOptions: SpawnOptions = {
        cwd: config.rootPath,
        stdio: 'inherit',
        detached: false,
    };

    if (config.rendererDevCommand) {
        return config.rendererDevCommand({
            config,

            exec: spawn,
            execOptions,
        });
    }

    switch (config.framework) {
        case Framework.NUXT: {
            return spawn('nuxt', ['-p', config.port.toString(), config.rendererDirectory], execOptions);
        }
        case Framework.NEXT: {
            return spawn('next', ['-p', config.port.toString(), config.rendererDirectory], execOptions);
        }
        default: {
            return spawn('vitron', ['vite', '--cmd', 'dev', '--port', config.port.toString()], execOptions);
        }
    }
}

/*
 * Copyright (c) 2021.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import spawn from 'cross-spawn';
import type { ChildProcess, SpawnOptions } from 'node:child_process';
import semver from 'semver';
import type { Config } from '../../config';
import { Framework, isPackageInfo } from '../../utils';
import type { PackageInfo } from '../../utils';

export function runRendererDevCommand(config: Config): ChildProcess {
    const execOptions: SpawnOptions = {
        cwd: config.get('rootPath'),
        stdio: 'inherit',
        detached: false,
    };

    const devCommand = config.get('rendererDevCommand');
    if (devCommand) {
        return devCommand({
            config: config.get(),

            exec: spawn,
            execOptions,
        });
    }

    const framework = config.get('framework') as PackageInfo;
    if (isPackageInfo(framework)) {
        switch (framework.name) {
            case Framework.NUXT: {
                if (semver.gte(framework.version, '3.0.0')) {
                    return spawn('nuxi', ['dev', config.get('rendererDirectory'), '-p', config.get('port').toString()], execOptions);
                }

                return spawn('nuxt', ['-p', config.get('port').toString(), config.get('rendererDirectory')], execOptions);
            }
            case Framework.NEXT: {
                return spawn('next', ['-p', config.get('port').toString(), config.get('rendererDirectory')], execOptions);
            }
        }
    }
    return spawn('vitron', ['vite', '--cmd', 'dev', '--port', config.get('port').toString()], execOptions);
}

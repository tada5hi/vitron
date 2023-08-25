/*
 * Copyright (c) 2021-2023.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import path from 'node:path';
import type { SpawnOptions } from 'node:child_process';
import spawn from 'cross-spawn';
import semver from 'semver';
import { build } from 'vite';
import type { Config } from '../../config';
import { EnvironmentName } from '../../constants';
import { Framework, isPackageInfo } from '../../utils';
import { moveAppRendererDirectory } from './move';
import { buildRendererConfig } from './config';

export async function buildRendererApp(config: Config): Promise<void> {
    const execOptions: SpawnOptions = {
        cwd: config.get('rootPath'),
        stdio: 'inherit',
        detached: false,
    };

    const command = config.get('rendererBuildCommand');
    if (command) {
        spawn.sync(command(config.get()));
        await moveAppRendererDirectory(config);
        return;
    }

    const framework = config.get('framework');
    if (isPackageInfo(framework)) {
        switch (framework.name) {
            case Framework.NUXT: {
                if (semver.gte(framework.version, '3.0.0')) {
                    spawn.sync('nuxi', ['build', config.get('rendererDirectory')], execOptions);
                    spawn.sync('nuxi', ['generate', config.get('rendererDirectory')], execOptions);
                } else {
                    spawn.sync('nuxt', ['build', config.get('rendererDirectory')], execOptions);
                    spawn.sync('nuxt', ['generate', config.get('rendererDirectory')], execOptions);
                }
                break;
            }
            case Framework.NEXT: {
                spawn.sync('next', ['build', config.get('rendererDirectory')], execOptions);
                spawn.sync('next', ['export', '-o', path.join(config.get('rendererDirectory'), 'dist')], execOptions);
                break;
            }
        }

        await moveAppRendererDirectory(config);
        return;
    }

    const viteConfig = await buildRendererConfig(config, EnvironmentName.PRODUCTION);
    await build(viteConfig);
}

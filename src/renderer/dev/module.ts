/*
 * Copyright (c) 2021.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import spawn from 'cross-spawn';
import { SpawnSyncOptions } from 'child_process';
import WebpackDevServer from 'webpack-dev-server';
import path from 'path';
import { Config } from '../../type';
import { RendererInstance } from '../type';

export function runRendererDevCommand(config: Config): RendererInstance | undefined {
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
                return {
                    type: 'childProcess',
                    value: spawn('nuxt', ['-p', config.port.toString(), config.rendererDirectory], execOptions),
                };
            }
            case 'next':
                return {
                    type: 'childProcess',
                    value: spawn('next', ['-p', config.port.toString(), config.rendererDirectory], execOptions),
                };
        }
    } else {
        const server = new WebpackDevServer({
            static: {
                directory: path.join(config.rootPath, config.rendererDirectory),
            },
            watchFiles: path.join(config.rootPath, config.rendererDirectory, '**', '*'),
            compress: true,
            port: config.port,
            hot: true,
        });

        return {
            type: 'webpackDevServer',
            value: server,
        };
    }

    return undefined;
}

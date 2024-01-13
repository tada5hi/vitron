/*
 * Copyright (c) 2023.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import process from 'node:process';
import { createLogger } from 'vite';
import type { Arguments, Argv, CommandModule } from 'yargs';
import {
    clearBuildDirectory,
    createBuildDirectory,
    createRenderer,
    startMainApp,
    startPreloadApp,
} from '../apps';
import { createElectron } from '../core';
import { createConfig } from '../config';
import { EnvironmentName } from '../constants';

export interface DevArguments extends Arguments {
    root: string;
    port: string | null;
}

export class DevCommand implements CommandModule {
    command = 'dev';

    describe = 'Run application in dev mode.';

    builder(args: Argv) {
        return args
            .option('root', {
                alias: 'r',
                default: process.cwd(),
                describe: 'Path to your project root directory.',
            })
            .option('port', {
                alias: 'p',
                default: null,
                describe: 'Port of the application server in dev mode.',
            });
    }

    async handler(raw: Arguments) {
        try {
            const args = raw as DevArguments;

            const logger = createLogger();

            // Project directory
            const baseDirectoryPath = args.root || process.cwd();

            // Config
            const config = await createConfig(baseDirectoryPath);

            // Port
            const port = args.port ? parseInt(args.port, 10) : config.get('port');
            config.set('port', port);

            config.set('env', EnvironmentName.DEVELOPMENT);

            // ----------------------------------------

            await clearBuildDirectory(config);
            await createBuildDirectory(config);

            // ----------------------------------------

            const electronProcess = createElectron(config, logger);
            const rendererProcess = createRenderer(config);
            /**
             * Entrypoint
             */
            await startMainApp(config, async () => {
                if (!electronProcess.up()) {
                    return;
                }

                electronProcess.stop();

                electronProcess.start();
            });

            /**
             * Preload
             */
            await startPreloadApp(config, async () => {
                if (!rendererProcess.up()) {
                    return;
                }

                await rendererProcess.reload();
            });

            // ----------------------------------------

            const killAllProcesses = async () => {
                electronProcess.stop();

                await rendererProcess.stop();

                process.exit(0);
            };

            process.on('SIGINT', killAllProcesses);
            process.on('SIGTERM', killAllProcesses);
            process.on('exit', killAllProcesses);

            // ----------------------------------------

            await rendererProcess.start();
            electronProcess.start();
        } catch (e) {
            // eslint-disable-next-line no-console
            console.log(e);

            throw e;
        }
    }
}

/*
 * Copyright (c) 2023.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import process from 'node:process';
import { inspect } from 'node:util';
import { createLogger } from 'vite';
import type { Arguments, Argv, CommandModule } from 'yargs';
import { runDevelopmentSession } from '../apps/dev';
import { createConfig } from '../config';
import { EnvironmentName } from '../constants';

import type { IDevArguments } from './types';



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
            const args = raw as IDevArguments;

            const logger = createLogger();

            // Project directory
            const baseDirectoryPath = args.root || process.cwd();

            // Config
            const config = await createConfig(baseDirectoryPath);

            // Port
            const port = args.port ? parseInt(args.port, 10) : config.get('port');

            config.set('port', port);

            config.set('env', EnvironmentName.DEVELOPMENT);

            const controller = new AbortController();
            const stop = () => controller.abort();

            process.on('SIGINT', stop);
            process.on('SIGTERM', stop);
            // The renderer leads its own session, so terminal-generated signals miss it and it must be stopped explicitly.
            process.on('SIGHUP', stop);
            process.on('SIGQUIT', stop);

            try {
                await runDevelopmentSession(config, logger, controller.signal);
            } finally {
                process.removeListener('SIGINT', stop);
                process.removeListener('SIGTERM', stop);
                process.removeListener('SIGHUP', stop);
                process.removeListener('SIGQUIT', stop);
            }
        } catch (e) {
            // process.exit() drops whatever a full pipe has not taken yet.
            await new Promise((resolve) => {
                process.stdout.write(`${inspect(e)}\n`, resolve);
            });

            // Rethrowing would make yargs print the error again together with the usage text.
            process.exit(1);
        }
    }
}

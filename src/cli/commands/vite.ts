/*
 * Copyright (c) 2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { build, createServer } from 'vite';
import type { Arguments, Argv, CommandModule } from 'yargs';
import { useConfig } from '../../config';
import { Environment } from '../../constants';
import { buildRendererConfig } from '../../renderer';

export interface CommandArguments extends Arguments {
    root: string;
    cmd: string;
    port: string | null
}

export class ViteCommand implements CommandModule {
    command = 'vite';

    describe = 'Bundle or run a modern web project in development mode with Hot Module Replacement (HMR).';

    builder(args: Argv) {
        return args
            .option('root', {
                alias: 'r',
                default: process.cwd(),
                describe: 'Path to your project root directory.',
            })
            .option('cmd', {
                demandOption: true,
                choices: ['build', 'dev'],
                describe: 'Specify the vite command.',
            })
            .option('port', {
                alias: 'p',
                default: null,
                describe: 'Port of the application server in dev mode.',
            });
    }

    async handler(raw: Arguments) {
        const args = raw as CommandArguments;

        // Project directory
        const baseDirectoryPath = args.root || process.cwd();

        // Config
        const config = await useConfig(baseDirectoryPath);

        // Port
        config.port = args.port ? parseInt(args.port, 10) : config.port || 9000;
        if (args.cmd === 'build') {
            config.env = Environment.PRODUCTION;
        } else {
            config.env = Environment.DEVELOPMENT;
        }

        const inlineConfig = await buildRendererConfig(config);

        switch (args.cmd) {
            case 'build': {
                await build(inlineConfig);

                process.exit(0);
                break;
            }
            case 'dev': {
                const server = await createServer(inlineConfig);

                await server.listen(config.port);
            }
        }
    }
}

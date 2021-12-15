/*
 * Copyright (c) 2021-2021.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { Arguments, Argv, CommandModule } from 'yargs';
import { useElectronAdapterConfig } from '../../config';

export interface WebpackArguments extends Arguments {
    root: string;
    type: string;
    command: string;
}

export class WebpackCommand implements CommandModule {
    command = 'webpack';

    describe = 'Run a webpack mode for a specific type.';

    builder(args: Argv) {
        return args
            .option('root', {
                alias: 'r',
                default: process.cwd(),
                describe: 'Path to your project root directory.',
            })
            .option('type', {
                alias: 't',
                default: 'main',
                choices: ['main', 'renderer'],
            })
            .option('command', {
                alias: 'cmd',
                demandOption: true,
                choices: ['dev', 'build'],
            });
    }

    async handler(raw: Arguments) {
        try {
            const args: WebpackArguments = raw as WebpackArguments;

            // Project directory
            const baseDirectoryPath = args.root || process.cwd();

            // Config
            const config = useElectronAdapterConfig(baseDirectoryPath);

            console.log(config);
        } catch (e) {
            // eslint-disable-next-line no-console
            console.log(e);

            throw e;
        }
    }
}

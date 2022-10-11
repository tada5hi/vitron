/*
 * Copyright (c) 2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { Arguments, Argv, CommandModule } from 'yargs';
import { InlineConfig, build, createServer } from 'vite';
import { useConfig } from '../../config';
import { Environment } from '../../constants';
import { buildRendererConfig } from '../../renderer';

export interface CommandArguments extends Arguments {
    root: string;
    cmd: string;
}

export class StaticCommand implements CommandModule {
    command = 'static';

    describe = 'Bundle a static web application for development or production.';

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
                describe: 'Specify the command.',
            });
    }

    async handler(raw: Arguments) {
        const args = raw as CommandArguments;

        // Project directory
        const baseDirectoryPath = args.root || process.cwd();

        // Config
        const config = useConfig(baseDirectoryPath);

        const env : `${Environment}` = args.cmd === 'build' ?
            'production' :
            'development';

        const inlineConfig : InlineConfig = buildRendererConfig(env, config);

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

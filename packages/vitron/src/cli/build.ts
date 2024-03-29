/*
 * Copyright (c) 2023.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { SpawnSyncOptions } from 'node:child_process';
import type { Arguments, Argv, CommandModule } from 'yargs';
import spawn from 'cross-spawn';
import { buildMainApp } from '../apps/main';
import { buildPreloadApp } from '../apps/preload';
import { clearBuildDirectory, createBuildDirectory } from '../apps/utils';
import { createConfig } from '../config';
import { EnvironmentName } from '../constants';
import {

    buildRendererApp,
} from '../apps/renderer';

export interface BuildArguments extends Arguments {
    root: string;
    flags: string[];
    config: string | 'electron-builder.yml';
}

export class BuildCommand implements CommandModule {
    command = 'build';

    describe = 'Build application for production.';

    builder(args: Argv) {
        return args
            .option('root', {
                alias: 'r',
                default: process.cwd(),
                describe: 'Path to your project root directory.',
            })
            .option('flags', {
                type: 'array',
                alias: 'f',
                default: [],
                describe: 'Specify platform(s) and architecture(s) to build the application for.',
                choices: ['all', 'mac', 'win', 'linux', 'ia32', 'x64', 'armv7l', 'arm64'],
            })
            .option('config', {
                alias: 'c',
                default: 'electron-builder.yml',
                describe: 'Name of the electron-builder configuration file.',
            });
    }

    async handler(raw: Arguments) {
        const args : BuildArguments = raw as BuildArguments;
        const builderArgs : string[] = [];

        // Project directory
        const rootPath = args.root || process.cwd();
        builderArgs.push(...['--project', rootPath]);

        // Config
        const config = await createConfig(rootPath);
        config.set('env', EnvironmentName.PRODUCTION);

        const configFileName = args.config || 'electron-builder.yml';
        builderArgs.push(...['--config', configFileName]);

        // Flags
        const flagsMapped = args.flags.map((flag) => `--${flag}`);
        builderArgs.push(...flagsMapped);

        // ----------------------------------------------------

        await clearBuildDirectory(config);
        await createBuildDirectory(config);

        // ----------------------------------------------------

        await buildRendererApp(config);

        // ----------------------------------------------------

        await buildMainApp(config);

        // ----------------------------------------------------

        await buildPreloadApp(config);

        // ----------------------------------------------------

        const spawnOptions: SpawnSyncOptions = {
            cwd: rootPath,
            stdio: 'inherit',
        };

        spawn.sync('electron-builder', builderArgs, spawnOptions);
    }
}

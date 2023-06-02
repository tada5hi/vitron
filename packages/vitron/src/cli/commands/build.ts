import type { Arguments, Argv, CommandModule } from 'yargs';
import path from 'node:path';
import type { SpawnSyncOptions } from 'node:child_process';
import spawn from 'cross-spawn';
import { build } from 'vite';
import { useConfig } from '../../config';
import { EnvironmentName } from '../../constants';
import { buildEntryPointConfig } from '../../entrypoint';
import {
    clearRendererBuilds,
    runRendererBuildCommand,
} from '../../renderer';
import { ensureDirectoryNotExists } from '../../utils';

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
        const config = await useConfig(rootPath);
        config.set('env', EnvironmentName.PRODUCTION);

        const configFileName = args.config || 'electron-builder.yml';
        builderArgs.push(...['--config', configFileName]);

        // Flags
        const flagsMapped = args.flags.map((flag) => `--${flag}`);
        builderArgs.push(...flagsMapped);

        // Clear old build data
        const entrypointDistDirectory = path.join(rootPath, config.get('entrypointDirectory'), 'dist');
        await ensureDirectoryNotExists(entrypointDistDirectory);

        const buildDirectory = path.join(rootPath, config.get('buildDirectory'));
        await ensureDirectoryNotExists(buildDirectory);

        // Clear old renderer data
        await clearRendererBuilds(config);

        // build renderer output
        await runRendererBuildCommand(config);

        await build(await buildEntryPointConfig(config));

        const spawnOptions: SpawnSyncOptions = {
            cwd: rootPath,
            stdio: 'inherit',
        };

        spawn.sync('electron-builder', builderArgs, spawnOptions);
    }
}
import { Arguments, Argv, CommandModule } from 'yargs';
import path from 'path';
import { SpawnSyncOptions } from 'child_process';
import spawn from 'cross-spawn';
import fs from 'fs-extra';

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

    async handler(raw: Arguments, exitProcess = true) {
        const args : BuildArguments = raw as BuildArguments;
        const builderArgs : string[] = [];

        // Project directory
        const baseDirectoryPath = args.root || process.cwd();
        builderArgs.push(...['--project', baseDirectoryPath]);

        // Config
        const configFileName = args.config || 'electron-builder.yml';
        builderArgs.push(...['--config', configFileName]);

        // Flags
        const flagsMapped = args.flags.map((flag) => `--${flag}`);
        builderArgs.push(...flagsMapped);

        const renderDirectoryPath = path.join(baseDirectoryPath, 'renderer');

        // Clear old electron and adapter build data
        fs.removeSync(path.join(baseDirectoryPath, 'app'));
        fs.removeSync(path.join(baseDirectoryPath, 'dist'));

        // Clear old nuxt data
        fs.removeSync(path.join(baseDirectoryPath, 'renderer', '.nuxt'));
        fs.removeSync(path.join(baseDirectoryPath, 'renderer', 'dist'));

        const spawnOptions: SpawnSyncOptions = {
            cwd: baseDirectoryPath,
            stdio: 'inherit',
        };

        spawn.sync('nuxt', ['build', renderDirectoryPath], spawnOptions);
        spawn.sync('nuxt', ['generate', renderDirectoryPath], spawnOptions);

        fs.copySync(path.join(renderDirectoryPath, 'dist'), path.join(baseDirectoryPath, 'app'));

        spawn.sync('node', [path.join(__dirname, '..', '..', 'compiler'), baseDirectoryPath], spawnOptions);

        spawn.sync('electron-builder', builderArgs, spawnOptions);
    }
}

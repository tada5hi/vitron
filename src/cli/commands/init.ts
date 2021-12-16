/*
 * Copyright (c) 2021.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { Arguments, Argv, CommandModule } from 'yargs';
import path from 'path';
import fs from 'fs-extra';
import { render } from 'mustache';
import spawn from 'cross-spawn';
import { SpawnSyncOptions } from 'child_process';
import { useElectronAdapterConfig } from '../../config';
import { ConfigDefault } from '../../config/constants';

async function getFiles(dir: string, relativePath = '') : Promise<string[]> {
    const direntMany = await fs.promises.readdir(dir, { withFileTypes: true });

    let files : string[] = [];
    // eslint-disable-next-line no-restricted-syntax
    for (const dirent of direntMany) {
        if (dirent.isDirectory()) {
            files = [
                ...files,
                ...(await getFiles(path.resolve(dir, dirent.name), path.join(relativePath, dirent.name))),
            ];
        } else {
            files.push(path.join(relativePath, dirent.name));
        }
    }

    return files;
}

export interface InitArguments extends Arguments {
    root: string;
}

export class InitCommand implements CommandModule {
    command = 'init';

    describe = 'Init the application file structure.';

    builder(args: Argv) {
        return args
            .option('root', {
                alias: 'r',
                default: process.cwd(),
                describe: 'Path to your project root directory.',
            });
    }

    async handler(raw: Arguments) {
        try {
            const args: InitArguments = raw as InitArguments;

            // Project directory
            const baseDirectoryPath = args.root || process.cwd();

            // Config
            const config = useElectronAdapterConfig(baseDirectoryPath);

            // Create main directory
            const entrypointDirectoryPath = path.join(config.rootPath, config.entrypointDirectory);
            try {
                await fs.promises.access(entrypointDirectoryPath);
            } catch (e) {
                await fs.promises.mkdir(entrypointDirectoryPath, { recursive: true });
                await fs.promises.mkdir(path.join(entrypointDirectoryPath, 'src'), { recursive: true });
            }

            // Create Renderer Directory
            const rendererDirectoryPath = path.join(config.rootPath, config.rendererDirectory);
            try {
                await fs.promises.access(rendererDirectoryPath);
            } catch (e) {
                await fs.promises.mkdir(rendererDirectoryPath, { recursive: true });
            }

            const tplPath: string = path.join(__dirname, '..', '..', '..', 'assets', 'templates');

            const templateFiles = await getFiles(tplPath);
            for (let i = 0; i < templateFiles.length; i++) {
                const relativeFilePath = templateFiles[i];

                const isTpl = relativeFilePath.split('.').pop() === 'tpl';

                let destinationRelativeFilePath : string = relativeFilePath;
                destinationRelativeFilePath = destinationRelativeFilePath.replace(
                    ConfigDefault.ENTRYPOINT_DIRECTORY.replace(/\//g, path.sep),
                    `${config.entrypointDirectory}`,
                );
                destinationRelativeFilePath = destinationRelativeFilePath.replace(
                    ConfigDefault.RENDERER_DIRECTORY.replace(/\//g, path.sep),
                    `${config.rendererDirectory}`,
                );

                if (isTpl) {
                    destinationRelativeFilePath = path.join(path.dirname(destinationRelativeFilePath), path.basename(destinationRelativeFilePath, '.tpl'));
                }

                // --------------------------------------------------------

                const sourceFilePath = path.join(tplPath, relativeFilePath);
                const destinationFilePath = path.join(config.rootPath, destinationRelativeFilePath);
                const destinationDirectoryPath = path.dirname(destinationFilePath);

                try {
                    await fs.promises.access(destinationDirectoryPath);
                } catch (e) {
                    await fs.promises.mkdir(destinationDirectoryPath, { recursive: true });
                }

                try {
                    await fs.promises.access(destinationFilePath, fs.constants.F_OK | fs.constants.R_OK);
                } catch (e) {
                    let content = await fs.promises.readFile(
                        path.join(sourceFilePath),
                        { encoding: 'utf-8' },
                    );

                    if (isTpl) {
                        content = render(content, {
                            entrypointDistDirectory: `${config.entrypointDirectory.replace(/\\/g, '/')}/dist`,
                            buildDirectory: config.buildDirectory.replace(/\\/g, '/'),
                        });
                    }

                    await fs.promises.writeFile(
                        destinationFilePath,
                        content,
                        { encoding: 'utf-8' },
                    );
                }
            }

            const spawnOptions: SpawnSyncOptions = {
                cwd: config.rootPath,
                stdio: 'inherit',
            };

            spawn.sync(
                config.npmClient,
                [
                    ...(config.npmClient === 'yarn' ? [] : ['install']),
                ],
                spawnOptions,
            );

            const syncArgs = [
                ...(
                    config.npmClient === 'yarn' ?
                        ['add', '-D'] :
                        ['install', '--save-dev']
                ),
                'electron',
                'electron-builder',
            ];

            spawn.sync(config.npmClient, syncArgs, spawnOptions);
        } catch (e) {
            // eslint-disable-next-line no-console
            console.log(e);

            throw e;
        }
    }
}

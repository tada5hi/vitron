/*
 * Copyright (c) 2021.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { removeFileNameExtension } from 'locter';
import type { Arguments, Argv, CommandModule } from 'yargs';
import path from 'node:path';
import fs from 'node:fs';
import { render } from 'mustache';
import { useConfig } from '../../config';
import { createRecursiveDirectory } from '../../utils';

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
            let baseDirectoryPath = args.root || process.cwd();
            if (!path.isAbsolute(baseDirectoryPath)) {
                baseDirectoryPath = path.join(process.cwd(), args.root);
            }

            // Config
            const config = await useConfig(baseDirectoryPath);

            const entrypointDirectoryPath = path.join(config.rootPath, config.entrypointDirectory);
            const rendererDirectoryPath = path.join(config.rootPath, config.rendererDirectory);

            const directoryPaths : string[] = [
                entrypointDirectoryPath,
                rendererDirectoryPath,
            ];

            // Create directories
            for (let i = 0; i < directoryPaths.length; i++) {
                await createRecursiveDirectory(directoryPaths[i]);
            }

            const tplPath: string = path.join(__dirname, '..', '..', '..', 'assets', 'templates');

            const templateFiles = await getFiles(tplPath);
            for (let i = 0; i < templateFiles.length; i++) {
                const sourceFilePath = path.join(tplPath, templateFiles[i]);

                const isTpl = templateFiles[i].split('.').pop() === 'tpl';
                const destinationFilePath = path.join(
                    config.rootPath,
                    isTpl ?
                        removeFileNameExtension(templateFiles[i], ['.tpl']) :
                        templateFiles[i],
                );
                const destinationDirectoryPath = path.dirname(destinationFilePath);
                await createRecursiveDirectory(destinationDirectoryPath);

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
        } catch (e) {
            // eslint-disable-next-line no-console
            console.log(e);

            throw e;
        }
    }
}

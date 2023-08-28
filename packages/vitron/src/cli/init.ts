/*
 * Copyright (c) 2021-2023.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import path from 'node:path';
import fs from 'node:fs';
import type { Arguments, Argv, CommandModule } from 'yargs';
import { createConfig } from '../config';
import { ASSETS_PATH } from '../constants';
import { ensureDirectoryExists } from '../utils';

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
            const config = await createConfig(baseDirectoryPath);

            const tplPath: string = path.join(ASSETS_PATH, 'templates');

            const templateFiles = await getFiles(tplPath);
            for (let i = 0; i < templateFiles.length; i++) {
                const sourceFilePath = path.join(tplPath, templateFiles[i]);

                const destinationFilePath = path.join(
                    config.get('rootPath'),
                    templateFiles[i],
                );

                const destinationDirectoryPath = path.dirname(destinationFilePath);
                await ensureDirectoryExists(destinationDirectoryPath);

                try {
                    await fs.promises.access(destinationFilePath, fs.constants.F_OK | fs.constants.R_OK);
                } catch (e) {
                    const content = await fs.promises.readFile(
                        path.join(sourceFilePath),
                        { encoding: 'utf-8' },
                    );

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

/*
 * Copyright (c) 2021.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { Arguments, Argv, CommandModule } from 'yargs';
import path from 'path';
import fs from 'fs-extra';
import { useElectronAdapterConfig } from '../../config';
import { copyTemplateFile } from '../utils';

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
            const mainDirectoryPath = path.join(config.rootPath, config.mainDirectory);
            try {
                await fs.promises.access(mainDirectoryPath);
            } catch (e) {
                await fs.promises.mkdir(mainDirectoryPath, { recursive: true });
            }

            // Create Renderer Directory
            const rendererDirectoryPath = path.join(config.rootPath, config.rendererDirectory);
            try {
                await fs.promises.access(rendererDirectoryPath);
            } catch (e) {
                await fs.promises.mkdir(rendererDirectoryPath, { recursive: true });
            }

            const tplPath: string = path.join(__dirname, '..', '..', '..', 'assets', 'templates');

            const templateMap : {srcPath: string, destPath :string}[] = [
                {
                    srcPath: path.join(tplPath, 'electron-builder.yml.tpl'),
                    destPath: path.join(config.rootPath, 'electron-builder.yml'),
                },
                {
                    srcPath: path.join(tplPath, 'tsconfig.json'),
                    destPath: path.join(mainDirectoryPath, 'tsconfig.json'),
                },
                {
                    srcPath: path.join(tplPath, 'main', 'index.ts.tpl'),
                    destPath: path.join(mainDirectoryPath, 'index.ts'),
                },
            ];

            const promises : Promise<any>[] = [];

            for (let i = 0; i < templateMap.length; i++) {
                const promise : Promise<any> = copyTemplateFile(
                    templateMap[i].srcPath,
                    templateMap[i].destPath,
                    {
                        buildDirectory: config.buildDirectory,
                    },
                );
                promises.push(promise);
            }

            await Promise.all(promises);
        } catch (e) {
            // eslint-disable-next-line no-console
            console.log(e);

            throw e;
        }
    }
}

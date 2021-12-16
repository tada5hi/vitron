/*
 * Copyright (c) 2021-2021.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { Arguments, Argv, CommandModule } from 'yargs';
import webpack, { Configuration } from 'webpack';
import WebpackDevServer from 'webpack-dev-server';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import path from 'path';
import { useElectronAdapterConfig } from '../../config';

export interface WebpackArguments extends Arguments {
    root: string;
    cmd: 'build' | 'dev';
}

export class WebpackCommand implements CommandModule {
    command = 'webpack';

    describe = 'Run a static html directory in hmr mode.';

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
                describe: 'Specify the webpack command.',
            });
    }

    async handler(raw: Arguments) {
        try {
            const args: WebpackArguments = raw as WebpackArguments;

            // Project directory
            const baseDirectoryPath = args.root || process.cwd();

            // Config
            const config = useElectronAdapterConfig(baseDirectoryPath);

            const configuration : Configuration = {
                mode: 'development',
                entry: {
                    index: path.join(config.rootPath, config.rendererDirectory),
                },
                plugins: [
                    new HtmlWebpackPlugin({
                        template: path.join(config.rootPath, config.rendererDirectory, 'index.html'),
                    }),
                ],
            };

            if (args.cmd === 'build') {
                configuration.output = {
                    filename: 'bundle.js',
                    path: path.join(config.rootPath, config.entrypointDirectory, 'dist'),
                };
            }

            const compiler = webpack(configuration);

            switch (args.cmd) {
                case 'build': {
                    await new Promise(((resolve, reject) => {
                        compiler.run((err: Error, stats: webpack.Stats) => {
                            if (err) {
                                // eslint-disable-next-line no-console
                                console.error(err.stack || err);
                                reject(err);
                            }
                            if (stats.hasErrors()) {
                                // eslint-disable-next-line no-console
                                console.error(stats.toString());
                                reject(stats);
                            }

                            resolve(stats);
                        });
                    }));
                    break;
                }
                case 'dev': {
                    const server = new WebpackDevServer({
                        static: {
                            directory: path.join(config.rootPath, config.rendererDirectory),
                        },
                        port: config.port,
                        hot: true,
                        watchFiles: path.join(config.rootPath, config.rendererDirectory),
                    }, compiler);

                    await server.start();

                    break;
                }
            }
        } catch (e) {
            // eslint-disable-next-line no-console
            console.log(e);

            throw e;
        }
    }
}

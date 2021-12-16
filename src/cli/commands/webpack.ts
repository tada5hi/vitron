/*
 * Copyright (c) 2021-2021.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { Arguments, Argv, CommandModule } from 'yargs';
import webpack, { Configuration } from 'webpack';
import merge from 'webpack-merge';
import WebpackDevServer from 'webpack-dev-server';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import path from 'path';
import { useElectronAdapterConfig } from '../../config';
import { Environment } from '../../type';

export interface WebpackArguments extends Arguments {
    root: string;
    cmd: string;
}

export class WebpackCommand implements CommandModule {
    command = 'webpack';

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

            const env : Environment = args.cmd === 'build' ?
                'production' :
                'development';

            let configuration : Configuration = {
                mode: env,
                entry: {
                    index: path.join(config.rootPath, config.rendererDirectory),
                },
                plugins: [
                    new HtmlWebpackPlugin({
                        filename: 'index.html',
                        inject: true,
                        template: path.join(config.rootPath, config.rendererDirectory, 'index.html'),
                    }),
                ],
                resolve: {
                    extensions: ['.js', '.jsx', '.json', '.ts', '.tsx'],
                    modules: [
                        path.join(config.rootPath, config.entrypointDirectory, 'dist'),
                        path.join(config.rootPath, 'node_modules'),
                        path.join(__dirname, '..', '..', '..', 'node_modules'),
                        'node_modules',
                    ],
                },
                module: {
                    rules: [
                        {
                            test: /\.html$/,
                            loader: path.join(__dirname, '..', '..', '..', 'node_modules', 'html-loader'),
                            options: {
                                minimize: true,
                            },
                        },
                        {
                            test: /\.css$/i,
                            use: [
                                path.join(__dirname, '..', '..', '..', 'node_modules', 'style-loader'),
                                path.join(__dirname, '..', '..', '..', 'node_modules', 'css-loader'),
                            ],
                        },
                        {
                            test: /\.m?js$/,
                            exclude: /(node_modules|bower_components)/,
                            use: {
                                loader: path.join(__dirname, '..', '..', '..', 'node_modules', 'babel-loader'),
                            },
                        },
                    ],
                },
            };

            if (args.cmd === 'build') {
                configuration.output = {
                    filename: 'bundle.js',
                    path: path.join(config.rootPath, config.rendererDirectory, 'dist'),
                };
            }

            if (typeof config.entrypointWebpack === 'function') {
                configuration = merge(
                    configuration,
                    config.entrypointWebpack({
                        webpackConfig: configuration,
                        rootConfig: config,
                        env,
                    }),
                );
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

                    try {
                        await server.start();
                    } catch (e) {
                        await server.stop();
                        // eslint-disable-next-line no-console
                        console.log(e);

                        process.exit(1);
                    }

                    break;
                }
            }
        } catch (e) {
            // eslint-disable-next-line no-console
            console.log(e);

            process.exit(1);
        }
    }
}

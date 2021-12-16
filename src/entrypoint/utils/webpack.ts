/*
 * Copyright (c) 2021.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import path from 'path';
import webpack from 'webpack';
import merge from 'webpack-merge';
import { useElectronAdapterConfig } from '../../config';

export function buildEntrypointWebpackConfig(
    env: 'development' | 'production',
    directoryPath?: string,
) : webpack.Configuration {
    directoryPath ??= process.cwd();

    const config = useElectronAdapterConfig(directoryPath);

    // eslint-disable-next-line @typescript-eslint/no-var-requires,global-require,import/no-dynamic-require
    const externals = require(path.join(config.rootPath, 'package.json'))
        .dependencies;

    const webpackConfig = merge(
        {
            mode: env,
            target: 'electron-main',
            node: {
                __dirname: false,
                __filename: false,
            },
            externals: [...Object.keys(externals || {})],
            devtool: 'source-map',
            resolve: {
                extensions: ['.js', '.jsx', '.json', '.ts', '.tsx'],
                modules: [
                    path.join(config.rootPath, config.entrypointDirectory, 'dist'),
                    path.join(config.rootPath, 'node_modules'),
                    path.join(__dirname, '..', '..', '..', 'node_modules'),
                    'node_modules',
                ],
            },
            output: {
                libraryTarget: 'commonjs2',
            },
            module: {
                rules: [
                    {
                        test: /\.(js|ts)x?$/,
                        use: {
                            loader: path.join(__dirname, '..', '..', '..', 'node_modules', 'babel-loader'),
                            options: {
                                cacheDirectory: true,
                                presets: [path.join(__dirname, '..', '..', '..', 'node_modules', '@babel', 'preset-typescript')],
                            },
                        },
                        exclude: [
                            /node_modules/,
                            path.join(config.rootPath, config.rendererDirectory),
                            path.join(config.rootPath, config.entrypointDirectory, 'dist'),
                        ],
                    },
                ],
            },
            plugins: [
                new webpack.EnvironmentPlugin({
                    NODE_ENV: env,
                }),
            ],
        },
        {
            entry: {
                index: path.join(directoryPath, config.entrypointDirectory, 'src', 'index.ts'),
            },
            output: {
                filename: 'index.js',
                path: path.join(directoryPath, config.entrypointDirectory, 'dist'),
            },
        },
    );

    if (typeof config.webpack === 'function') {
        return config.webpack({
            config: webpackConfig,
            env,
        });
    }

    return webpackConfig;
}

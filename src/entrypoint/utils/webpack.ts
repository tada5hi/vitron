/*
 * Copyright (c) 2021.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import path from 'path';
import webpack, { Configuration } from 'webpack';
import merge from 'webpack-merge';
import fs from 'fs-extra';
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

    let babelLoader = path.join(__dirname, '..', '..', '..', 'node_modules', 'babel-loader');
    if (!fs.existsSync(babelLoader)) {
        babelLoader = 'babel-loader';
    }

    let babelTsPreset = path.join(__dirname, '..', '..', '..', 'node_modules', '@babel', 'preset-typescript');
    if (!fs.existsSync(babelTsPreset)) {
        babelTsPreset = '@babel/preset-typescript';
    }

    const webpackConfig : Configuration = {
        mode: env,
        target: 'electron-main',
        node: {
            __dirname: false,
            __filename: false,
        },
        externals: [...Object.keys(externals || {})],
        entry: {
            index: path.join(directoryPath, config.entrypointDirectory, 'index.ts'),
        },
        output: {
            libraryTarget: 'commonjs2',
            filename: 'index.js',
            path: path.join(directoryPath, config.entrypointDirectory, 'dist'),
        },
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
        module: {
            rules: [
                {
                    test: /\.(js|ts)x?$/,
                    use: {
                        loader: babelLoader,
                        options: {
                            cacheDirectory: true,
                            presets: [babelTsPreset],
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
    };

    if (typeof config.entrypointWebpack === 'function') {
        return merge(config.entrypointWebpack({
            webpackConfig,
            rootConfig: config,
            env,
        }));
    }

    return webpackConfig;
}

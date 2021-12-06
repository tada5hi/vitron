import path from 'path';
import webpack from 'webpack';
import merge from 'webpack-merge';
import { useElectronAdapterConfig } from './module';
import { Config } from '../type';

export function buildWebpackBaseConfig(
    env: 'development' | 'production',
    config: Config,
) : webpack.Configuration {
    // eslint-disable-next-line @typescript-eslint/no-var-requires,global-require,import/no-dynamic-require
    const externals = require(path.join(config.rootPath, 'package.json'))
        .dependencies;

    return {
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
                path.join(config.rootPath, config.buildDirectory),
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
                        loader: 'babel-loader',
                        options: {
                            cacheDirectory: true,
                            presets: ['@babel/preset-typescript'],
                        },
                    },
                    exclude: [
                        /node_modules/,
                        path.join(config.rootPath, config.rendererDirectory),
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
}

export function buildWebpackConfig(
    env: 'development' | 'production',
    directoryPath?: string,
) : webpack.Configuration {
    directoryPath ??= process.cwd();

    const config = useElectronAdapterConfig(directoryPath);

    const webpackConfig = merge(
        buildWebpackBaseConfig(env, config),
        {
            entry: {
                index: path.join(directoryPath, config.mainDirectory, 'index.ts'),
            },
            output: {
                filename: 'index.js',
                path: path.join(directoryPath, config.buildDirectory),
            },
        },
    );

    if (typeof config.webpack === 'function') {
        return config.webpack(webpackConfig, env);
    }

    return webpackConfig;
}

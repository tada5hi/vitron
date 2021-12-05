import path from 'path';
import webpack from 'webpack';
import merge from 'webpack-merge';

export function buildWebpackBaseConfig(
    env: 'development' | 'production',
    directoryPath?: string,
) : webpack.Configuration {
    directoryPath ??= process.cwd();

    // eslint-disable-next-line @typescript-eslint/no-var-requires,global-require,import/no-dynamic-require
    const externals = require(path.join(directoryPath, 'package.json'))
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
            modules: [path.join(directoryPath, 'app'), 'node_modules'],
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
                        path.join(directoryPath, 'renderer'),
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

    return merge(
        buildWebpackBaseConfig(env, directoryPath),
        {
            entry: {
                index: path.join(directoryPath, 'main', 'index.ts'),
            },
            output: {
                filename: 'index.js',
                path: path.join(directoryPath, 'app'),
            },
        },
    );
}

/*
 * Copyright (c) 2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import resolve from '@rollup/plugin-node-resolve';
import swc from "@rollup/plugin-swc";

import { builtinModules } from 'node:module';

const extensions = [
    '.js', '.mjs', '.cjs', '.ts', '.mts', '.cts'
];

export function createPlugins({
  pluginsPre = [],
  pluginsPost = []
}) {
    return [
        ...pluginsPre,

        // Allows node_modules resolution
        resolve({ extensions}),

        // Compile TypeScript/JavaScript files
        swc(),

        ...pluginsPost
    ]
}

export function createConfig(
    {
        pkg,
        pluginsPre = [],
        pluginsPost = []
    }
) {
    const external = Object.keys(pkg.dependencies || {})
        .concat(Object.keys(pkg.peerDependencies || {}))
        .concat(builtinModules)

    return {
        input: 'src/index.ts',
        external,
        output: [
            {
                format: 'cjs',
                file: pkg.main,
                exports: 'named',
                sourcemap: true
            },
            {
                format: 'es',
                file: pkg.module,
                sourcemap: true
            }
        ],
        plugins: createPlugins({pluginsPre, pluginsPost})
    };
}

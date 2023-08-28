/*
 * Copyright (c) 2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import fs from 'node:fs';
import {createConfig, createPlugins} from '../../rollup.config.mjs';
import {builtinModules} from "node:module";

const pkg = JSON.parse(fs.readFileSync(new URL('./package.json', import.meta.url), {encoding: 'utf-8'}));

const external = Object.keys(pkg.dependencies || {})
    .concat(Object.keys(pkg.peerDependencies || {}))
    .concat(builtinModules)

export default [
    {
        input: 'src/index.ts',
        external,
        output: [
            {
                format: 'cjs',
                file: pkg.main,
                exports: 'named',
                sourcemap: true,
                banner: '#!/usr/bin/env node'
            },
            {
                format: 'es',
                file: pkg.module,
                sourcemap: true,
                banner: '#!/usr/bin/env node'
            }
        ],
        plugins: createPlugins({})
    },
    {
        input: 'src/di/inject.ts',
        external,
        output: [
            {
                format: 'cjs',
                file: pkg.exports['./inject'].require,
                exports: 'named',
                sourcemap: true
            },
            {
                format: 'es',
                file: pkg.exports['./inject'].import,
                sourcemap: true
            }
        ],
        plugins: createPlugins({})
    },
    {
        input: 'src/di/provide.ts',
        external,
        output: [
            {
                format: 'cjs',
                file: pkg.exports['./provide'].require,
                exports: 'named',
                sourcemap: true
            },
            {
                format: 'es',
                file: pkg.exports['./provide'].import,
                sourcemap: true
            }
        ],
        plugins: createPlugins({})
    }
]

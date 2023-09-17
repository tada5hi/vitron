/*
 * Copyright (c) 2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import fs from 'node:fs';
import {createPlugins} from '../../rollup.config.mjs';
import {builtinModules} from "node:module";
import ts from 'rollup-plugin-ts';
import copy from "rollup-plugin-copy";
import path from "node:path";

const pkg = JSON.parse(fs.readFileSync(new URL('./package.json', import.meta.url), {encoding: 'utf-8'}));

const external = Object.keys(pkg.dependencies || {})
    .concat(Object.keys(pkg.peerDependencies || {}))
    .concat(builtinModules);

const copyPackageJson = (destination) => {
    return copy({
        targets: [
            { src: 'assets/package.json', dest: destination}
        ]
    })
}

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
        plugins: [
            ts({
                tsconfig: 'tsconfig.build.json'
            }),
            ...createPlugins({})
        ]
    },
    {
        input: 'src/exports/main/index.ts',
        external,
        output: [
            {
                format: 'cjs',
                file: pkg.exports['./main'].require.default,
                exports: 'named'
            },
            {
                format: 'es',
                file: pkg.exports['./main'].import.default
            }
        ],
        plugins: [
            ts({
                tsconfig: 'tsconfig.build.json',
                include: ['src/exports/main/*.ts'],
                hook: {
                    outputPath: (filePath) => path.join('main', path.basename(filePath))
                }
            }),
            copyPackageJson('main'),
            ...createPlugins({})
        ]
    },
    {
        input: 'src/exports/preload/index.ts',
        external,
        output: [
            {
                format: 'cjs',
                file: pkg.exports['./preload'].require.default,
                exports: 'named'
            },
            {
                format: 'es',
                file: pkg.exports['./preload'].import.default
            }
        ],
        plugins: [
            ts({
                tsconfig: 'tsconfig.build.json',
                include: ['src/exports/preload/*.ts'],
                hook: {
                    outputPath: (filePath) => path.join('preload', path.basename(filePath))
                }
            }),
            copyPackageJson('preload'),
            ...createPlugins({})
        ]
    },
    {
        input: 'src/exports/renderer/index.ts',
        external,
        output: [
            {
                format: 'cjs',
                file: pkg.exports['./renderer'].require.default,
                exports: 'named'
            },
            {
                format: 'es',
                file: pkg.exports['./renderer'].import.default
            }
        ],
        plugins: [
            ts({
                tsconfig: 'tsconfig.build.json',
                include: ['src/exports/renderer/*.ts'],
                hook: {
                    outputPath: (filePath) => path.join('renderer', path.basename(filePath))
                }
            }),
            copyPackageJson('renderer'),
            ...createPlugins({})
        ]
    }
]

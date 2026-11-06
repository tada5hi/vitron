/*
 * Copyright (c) 2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { builtinModules } from 'node:module';

export function getNodeBuiltInModules() {
    return [
        ...builtinModules,
        ...builtinModules.filter((module) => !module.startsWith('node:')).map((module) => `node:${module}`),
    ];
}

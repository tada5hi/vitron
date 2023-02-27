/*
 * Copyright (c) 2021.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { Config, ConfigInput } from '../type';
import { buildConfig, findConfig } from './utils';

let instance : Config | undefined;
let instancePromise : Promise<ConfigInput> | undefined;

export async function useConfig(directoryPath: string) : Promise<Config> {
    if (typeof instance !== 'undefined') {
        return instance;
    }

    if (!instancePromise) {
        instancePromise = findConfig(directoryPath);
    }

    instance = buildConfig(await instancePromise);

    return instance;
}

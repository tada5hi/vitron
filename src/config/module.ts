/*
 * Copyright (c) 2021.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { Config, OptionsInput } from './type';
import { buildConfig, loadOptions } from './utils';

let instance : Config | undefined;
let instancePromise : Promise<OptionsInput> | undefined;

export async function useConfig(directoryPath: string) : Promise<Config> {
    if (typeof instance !== 'undefined') {
        return instance;
    }

    if (!instancePromise) {
        instancePromise = loadOptions(directoryPath);
    }

    instance = buildConfig(await instancePromise);

    return instance;
}

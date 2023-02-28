/*
 * Copyright (c) 2021.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { Continu } from 'continu';
import type { Options, OptionsInput } from './type';
import { buildConfig, findConfig } from './utils';

let instance : Continu<Options, OptionsInput> | undefined;
let instancePromise : Promise<OptionsInput> | undefined;

export async function useConfig(directoryPath: string) : Promise<Continu<Options, OptionsInput>> {
    if (typeof instance !== 'undefined') {
        return instance;
    }

    if (!instancePromise) {
        instancePromise = findConfig(directoryPath);
    }

    instance = buildConfig(await instancePromise);

    return instance;
}

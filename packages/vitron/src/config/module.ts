/*
 * Copyright (c) 2021.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { getPort } from 'get-port-please';
import type { Config } from './type';
import { buildConfig, loadOptions } from './utils';

let instance : Config | undefined;

export async function createConfig(directoryPath: string) : Promise<Config> {
    if (typeof instance !== 'undefined') {
        return instance;
    }

    const input = await loadOptions(directoryPath);
    instance = buildConfig(input);

    // find open port
    if (!instance.has('port')) {
        const port = await getPort();
        instance.set('port', port);
    }

    return instance;
}

/*
 * Copyright (c) 2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { Environment } from '../../constants';
import { Config } from '../../type';
import { hasEnv, requireFromEnv } from '../../utils';

export function extractConfigFromEnv() : Partial<Config> {
    const config : Partial<Config> = {};

    if (hasEnv('NODE_ENV')) {
        config.env = requireFromEnv('NODE_ENV') as Environment;
    }

    return config;
}

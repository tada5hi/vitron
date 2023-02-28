/*
 * Copyright (c) 2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { EnvironmentName } from '../../constants';
import { hasEnv, requireFromEnv } from '../../utils';
import type { Options } from '../type';

export function extractConfigFromEnv() : Partial<Options> {
    const config : Partial<Options> = {};

    if (hasEnv('NODE_ENV')) {
        config.env = requireFromEnv('NODE_ENV') as EnvironmentName;
    }

    return config;
}

/*
 * Copyright (c) 2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { merge } from 'smob';
import type { Config, ConfigInput } from '../../type';
import { extendConfigWithDefaults } from './defaults';
import { extractConfigFromEnv } from './env';
import { validateConfig } from './validate';

export function buildConfig(config: ConfigInput) : Config {
    return extendConfigWithDefaults(
        validateConfig(
            merge(
                extractConfigFromEnv(),
                config,
            ),
        ),
    );
}

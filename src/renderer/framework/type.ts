/*
 * Copyright (c) 2023.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { Framework } from './constants';

export type FrameworkInfo = {
    /**
     * Name
     *
     * e.g. nuxt, next, ...
     */
    name: `${Framework}`,
    /**
     * Semver version number
     * e.g. v2.0.0
     */
    version: string
};

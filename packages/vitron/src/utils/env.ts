/*
 * Copyright (c) 2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { hasOwnProperty } from 'smob';

export function hasEnv(key: string) : boolean {
    return hasOwnProperty(process.env, key);
}

export function requireFromEnv<T>(key: string, alt?: T) : T | string {
    if (
        typeof process.env[key] === 'undefined' &&
        typeof alt === 'undefined'
    ) {
        // eslint-disable-next-line no-console
        console.error(`[APP ERROR] Missing variable: ${key}`);

        return process.exit(1);
    }

    return process.env[key] ?? alt as T | string;
}

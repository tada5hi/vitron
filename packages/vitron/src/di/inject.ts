/*
 * Copyright (c) 2023.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

export function inject<T = any>(key: string) : T {
    if (
        typeof window !== 'undefined' &&
        Object.prototype.hasOwnProperty.call(window, key)
    ) {
        return window[key as keyof typeof window];
    }

    throw new Error(`The key ${key} was not injected by the preload script.`);
}

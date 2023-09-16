/*
 * Copyright (c) 2023.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { contextBridge } from 'electron';

/**
 * Expose a value under a specific key to the renderer process.
 *
 * @param key
 * @param value
 */
export function provide(key: string, value: unknown) {
    if (process.contextIsolated) {
        contextBridge.exposeInMainWorld(key, value);
    } else if (typeof window !== 'undefined') {
        Object.assign(window, {
            [key]: value,
        });
    }
}

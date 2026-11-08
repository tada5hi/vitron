/*
 * Copyright (c) 2023.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

export type ViteWatchHook = () => void | Promise<void>;

export type ViteWatchBuild = {
    ready: Promise<void>,
    close: () => Promise<void>,
};

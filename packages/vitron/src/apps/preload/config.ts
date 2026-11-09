/*
 * Copyright (c) 2022-2023.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { InlineConfig } from 'vite';
import type { Config } from '../../config';
import { AppName } from '../constants';
import { applyConfigHook } from '../utils/config-hook';
import { buildElectronConfig } from '../utils/electron-config';

export async function buildPreloadConfig(
    config: Config,
) : Promise<InlineConfig | undefined> {
    const shared = await buildElectronConfig(config, AppName.PRELOAD);

    if (!shared) {
        return undefined;
    }

    const inlineConfig : InlineConfig = {
        ...shared,
        build: {
            ...shared.build,
            emptyOutDir: true,
        },
    };

    return applyConfigHook(inlineConfig, config.get('preloadConfig'));
}

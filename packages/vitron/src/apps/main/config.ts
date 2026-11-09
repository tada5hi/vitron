/*
 * Copyright (c) 2022-2023.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import replace from '@rollup/plugin-replace';
import type { InlineConfig } from 'vite';
import type { Config } from '../../config';
import { AppName } from '../constants';
import { applyConfigHook } from '../utils/config-hook';
import { buildElectronConfig } from '../utils/electron-config';

export async function buildMainConfig(
    config: Config,
) : Promise<InlineConfig> {
    const shared = await buildElectronConfig(config, AppName.MAIN);

    if (!shared) {
        throw new Error('The main entrypoint file could not be located...');
    }

    const inlineConfig : InlineConfig = {
        ...shared,
        define: {
            NODE_ENV: `"${config.get('env')}"`,
            PORT: `"${config.get('port')}"`,
        },
        build: {
            ...shared.build,
            emptyOutDir: false,
            rollupOptions: {
                ...shared.build!.rollupOptions,
                plugins: [
                    replace({
                        preventAssignment: true,
                        uncrypto: 'crypto',
                        'process.env.NODE_ENV': `"${config.get('env')}"`,
                        'process.env.PORT': `"${config.get('port')}"`,
                    }),
                ],
            },
        },
        server: {},
    };

    const customConfig = config.get('mainConfig');

    if (customConfig) {
        return applyConfigHook(inlineConfig, customConfig);
    }

    return inlineConfig;
}

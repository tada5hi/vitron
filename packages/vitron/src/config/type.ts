/*
 * Copyright (c) 2023.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { Continu } from 'continu';
import type { UserConfig } from 'vite';
import type { EnvironmentName } from '../constants';
import type { PackageInfo } from '../utils';

export type Options = {
    env: `${EnvironmentName}`,
    port: number,
    rootPath: string,

    framework?: PackageInfo,

    buildDirectory: string,

    preloadDirectory: string,
    preloadConfig?: (config: UserConfig) => UserConfig,

    mainDirectory: string,
    mainConfig?: (config: UserConfig) => UserConfig,

    rendererDirectory: string,
    rendererBuildDirectory: string
    rendererBuildCommand?: (options: Options) => string,
    rendererDevCommand?: (options: Options) => string,
    rendererConfig: (config: UserConfig) => UserConfig
};

export type OptionsInput = Partial<Omit<Options, 'framework'>> & {
    framework?: PackageInfo | string
};

export type Config = Continu<Options, OptionsInput>;

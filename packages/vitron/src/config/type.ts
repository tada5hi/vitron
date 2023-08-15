/*
 * Copyright (c) 2023.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { ChildProcess } from 'node:child_process';
import type { Continu } from 'continu';
import type { UserConfig } from 'vite';
import type { EnvironmentName } from '../constants';
import type { RendererBuildCommandContext, RendererDevCommandContext } from '../type';
import type { PackageInfo } from '../utils/package';

export type Options = {
    env: `${EnvironmentName}`,
    port: number,
    rootPath: string,

    framework?: PackageInfo,

    buildDirectory: string,

    entrypointDirectory: string,
    entrypointConfig?: (config: UserConfig) => UserConfig,

    rendererDirectory: string,
    rendererBuildDirectory: string[],
    rendererBuildCommand?: (context: RendererBuildCommandContext) => unknown,
    rendererDevCommand?: (context: RendererDevCommandContext) => ChildProcess,
    rendererConfig: (config: UserConfig) => UserConfig
};

export type OptionsInput = Partial<Omit<Options, 'framework' | 'rendererBuildDirectory'>> & {
    framework?: PackageInfo | string,
    rendererBuildDirectory?: string | string[]
};

export type Config = Continu<Options, OptionsInput>;

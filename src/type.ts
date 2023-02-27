import type { ChildProcess, SpawnOptions, SpawnSyncOptions } from 'child_process';
import type spawn from 'cross-spawn';
import type { UserConfig } from 'vite';
import type { Environment, Framework } from './constants';

export type Config = {
    env: `${Environment}`,
    port: number,
    rootPath: string,

    framework?: `${Framework}`,

    buildDirectory: string,

    entrypointDirectory: string,
    entrypointConfig?: (config: UserConfig) => UserConfig,

    rendererDirectory: string,
    rendererBuildDirectory: string | string[],
    rendererBuildCommand?: (context: RendererBuildCommandContext) => unknown,
    rendererDevCommand?: (context: RendererDevCommandContext) => ChildProcess,
    rendererConfig: (config: UserConfig) => UserConfig
};

export type RendererBuildCommandContext = {
    config: Config,

    exec: typeof spawn.sync,
    execOptions: SpawnSyncOptions
};

export type RendererDevCommandContext = {
    config: Config,

    exec: typeof spawn,
    execOptions: SpawnOptions
};

export type ConfigInput = Partial<Config>;

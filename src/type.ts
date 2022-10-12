import { ChildProcess, SpawnOptions, SpawnSyncOptions } from 'child_process';
import spawn from 'cross-spawn';
import { UserConfig } from 'vite';
import { Environment, Framework } from './constants';

export type Config = {
    env: `${Environment}`,
    port: number,
    rootPath: string,

    framework?: `${Framework}`,

    buildDirectory: string,

    entrypointDirectory: string,
    entrypointConfig?: (config: UserConfig) => UserConfig,

    rendererDirectory: string,
    rendererBuildPath: string | string[],
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

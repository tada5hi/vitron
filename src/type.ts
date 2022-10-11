import { SpawnSyncOptions } from 'child_process';
import spawn from 'cross-spawn';
import { UserConfig } from 'vite';
import { Environment, Framework, NpmClient } from './constants';

export type Config = {
    port?: number,
    npmClient?: `${NpmClient}`,

    framework?: `${Framework}`,

    rootPath?: string,

    buildDirectory?: string,

    entrypointDirectory?: string,
    entrypointConfig?: (config: UserConfig) => UserConfig,

    rendererDirectory?: string,
    rendererBuildPaths?: string[],
    rendererBuildCommands?: (context: ConfigCommandContext) => any | undefined,
    rendererDevCommands?: (context: ConfigCommandContext) => any | undefined,
    rendererConfig?: (config: UserConfig) => UserConfig
};

export type ConfigCommandContext = {
    env: `${Environment}`
    rootPath: string,

    exec: typeof spawn,
    execSync: typeof spawn.sync,
    execOptions: SpawnSyncOptions
};

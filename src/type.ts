import { Configuration } from 'webpack';
import {
    ChildProcessWithoutNullStreams,
    SpawnOptions,
    SpawnSyncOptions,
    spawn, spawnSync,
} from 'child_process';

export type Config = {
    port?: number,

    framework?: Framework,

    rootPath?: string,

    buildDirectory?: string,
    buildTempDirectory?: string,
    mainDirectory?: string,

    webpack?: (context: ConfigWebpackContext) => Configuration,

    rendererDirectory?: string,
    rendererBuildPaths?: string[],
    rendererBuildCommands?: (context: ConfigCommandContext) => ChildProcessWithoutNullStreams | undefined,
    rendererDevCommands?: (context: ConfigCommandContext) => ChildProcessWithoutNullStreams | undefined
};

export type ConfigBaseContext = {
    env: Environment
};

export type ConfigCommandContext = ConfigBaseContext & {
    rootPath: string,
    exec: typeof spawn,
    execSync: typeof spawnSync,
    execOptions: SpawnSyncOptions
};

export type ConfigWebpackContext = ConfigBaseContext & {
    config: Configuration
};

export type Framework = 'nuxt' | 'next';
export type Command = {
    key: string,
    args: string[],
    execOptions?: SpawnOptions
};

export type CommandType = 'build' | 'dev';

export type Environment = 'production' | 'development' | 'test';
export type RegisterRenderedFilesContext = {
    isCorsEnabled?: boolean,
    scheme?: string
    directory: string,
    partition?: string
};

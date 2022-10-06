import { SpawnSyncOptions } from 'child_process';
import spawn from 'cross-spawn';
import { Configuration } from 'webpack';
import { Environment, Framework, NpmClient } from './constants';

export type Config = {
    port?: number,
    npmClient?: `${NpmClient}`,

    framework?: `${Framework}`,

    rootPath?: string,

    buildDirectory?: string,

    entrypointDirectory?: string,
    entrypointWebpack?: (context: ConfigWebpackContext) => Configuration,

    rendererDirectory?: string,
    rendererBuildPaths?: string[],
    rendererBuildCommands?: (context: ConfigCommandContext) => any | undefined,
    rendererDevCommands?: (context: ConfigCommandContext) => any | undefined,
    rendererWebpack?: (context: ConfigWebpackContext) => Configuration
};

export type ConfigCommandContext = {
    env: `${Environment}`
    rootPath: string,

    exec: typeof spawn,
    execSync: typeof spawn.sync,
    execOptions: SpawnSyncOptions
};

export type ConfigWebpackContext = {
    webpackConfig: Configuration,
    rootConfig: Config,
    env: `${Environment}`
};

export type RegisterRenderedFilesContext = {
    isCorsEnabled?: boolean,
    scheme?: string
    directory: string,
    partition?: string
};

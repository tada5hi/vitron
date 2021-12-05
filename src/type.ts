import { Configuration } from 'webpack';
import { SpawnOptions } from 'child_process';

export type Config = {
    port?: number,

    framework?: Framework,

    rootPath?: string,
    mainDirectory?: string,

    webpack?: (config: Configuration, env: Environment) => Configuration,

    rendererDirectory?: string,
    rendererBuildPaths?: string[],
    rendererBuildCommands?: Command[] | ((env: Environment, rootPath: string) => Command[]),
    rendererDevCommands?: Command[] | ((env: Environment, rootPath: string) => Command[])
};

export type Framework = 'nuxt' | 'next';

export type Command = {
    key: string,
    args?: string[],
    options?: SpawnOptions
};

export type CommandType = 'build' | 'dev';

export type Environment = 'production' | 'development' | 'test';

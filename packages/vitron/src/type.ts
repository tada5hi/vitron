import type { SpawnOptions, SpawnSyncOptions } from 'node:child_process';
import type spawn from 'cross-spawn';
import type { Options } from './config';

export type RendererBuildCommandContext = {
    config: Options,

    exec: typeof spawn.sync,
    execOptions: SpawnSyncOptions
};

export type RendererDevCommandContext = {
    config: Options,

    exec: typeof spawn,
    execOptions: SpawnOptions
};

import type { Arguments } from 'yargs';

export interface IBuildArguments extends Arguments {
    root: string;
    flags: string[];
    config: string | 'electron-builder.yml';
}

export interface IDevArguments extends Arguments {
    root: string;
    port: string | null;
}

export interface IInitArguments extends Arguments {
    root: string;
}

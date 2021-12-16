#!/usr/bin/env node
import 'reflect-metadata';
import yargs from 'yargs';
import { BuildCommand, DevCommand } from './commands';
import { InitCommand } from './commands/init';
import { WebpackCommand } from './commands/webpack-dev';

// eslint-disable-next-line no-unused-expressions,@typescript-eslint/no-unused-expressions
yargs
    .scriptName('electron-adapter')
    .usage('Usage: $0 <command> [options]')
    .demandCommand(1)
    .command(new BuildCommand())
    .command(new DevCommand())
    .command(new InitCommand())
    .command(new WebpackCommand())
    .strict()
    .alias('v', 'version')
    .help('h')
    .alias('h', 'help')
    .argv;

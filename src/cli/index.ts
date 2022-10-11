#!/usr/bin/env node
import yargs from 'yargs';
import { BuildCommand, DevCommand } from './commands';
import { InitCommand } from './commands/init';
import { StaticCommand } from './commands/vite';

// eslint-disable-next-line no-unused-expressions,@typescript-eslint/no-unused-expressions
yargs
    .scriptName('vitron')
    .usage('Usage: $0 <command> [options]')
    .demandCommand(1)
    .command(new BuildCommand())
    .command(new DevCommand())
    .command(new InitCommand())
    .command(new StaticCommand())
    .strict()
    .alias('v', 'version')
    .help('h')
    .alias('h', 'help')
    .argv;

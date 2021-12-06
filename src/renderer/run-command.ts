import spawn from 'cross-spawn';
import path from 'path';
import { ChildProcess, SpawnSyncOptions } from 'child_process';
import fs from 'fs-extra';
import { Command, CommandType, Config } from '../type';

export function runRendererCommand(type: CommandType, config: Config) : ChildProcess | undefined {
    const renderDirectoryPath = path.join(config.rootPath, config.rendererDirectory);

    const commands : Command[] = [];

    if (config.framework) {
        switch (config.framework) {
            case 'nuxt':
                switch (type) {
                    case 'dev':
                        commands.push({ key: 'nuxt', args: ['-p', config.port.toString(), renderDirectoryPath] });
                        break;
                    case 'build':
                        commands.push({ key: 'nuxt', args: ['build', renderDirectoryPath] });
                        commands.push({ key: 'nuxt', args: ['generate', renderDirectoryPath] });
                        break;
                }
                break;
            case 'next':
                switch (type) {
                    case 'dev':
                        commands.push({ key: 'next', args: ['-p', config.port.toString(), renderDirectoryPath] });
                        break;
                    case 'build':
                        commands.push({ key: 'next', args: ['build', renderDirectoryPath] });
                        commands.push({ key: 'next', args: ['export', '-o', path.join(config.rootPath, config.buildDirectory), renderDirectoryPath] });
                        break;
                }
                break;
        }
    }

    switch (type) {
        case 'build':
            if (config.rendererBuildCommands) {
                if (Array.isArray(config.rendererBuildCommands)) {
                    commands.push(...config.rendererBuildCommands);
                } else {
                    commands.push(...config.rendererBuildCommands('production', config.rootPath));
                }
            }
            break;
        case 'dev':
            if (config.rendererDevCommands) {
                if (Array.isArray(config.rendererDevCommands)) {
                    commands.push(...config.rendererDevCommands);
                } else {
                    commands.push(...config.rendererDevCommands('production', config.rootPath));
                }
            }
            break;
    }

    const spawnOptions: SpawnSyncOptions = {
        cwd: config.rootPath,
        stdio: 'inherit',
    };

    let command : Command | undefined;

    if (type === 'dev') {
        command = commands.pop();
    }

    if (commands.length > 0) {
        for (let i = 0; i < commands.length; i++) {
            spawn.sync(commands[i].key, commands[i].args, spawnOptions);
        }
    }

    if (
        type === 'build' &&
        config.framework &&
        config.framework === 'nuxt'
    ) {
        fs.copySync(
            path.join(renderDirectoryPath, 'dist'),
            path.join(config.rootPath, config.buildDirectory),
        );
    }

    return command ? spawn(command.key, command.args, spawnOptions) : undefined;
}

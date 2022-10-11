import path from 'path';
import { build } from 'vite';
import { Arguments, Argv, CommandModule } from 'yargs';
import { ChildProcess } from 'child_process';
import spawn from 'cross-spawn';
import { useConfig } from '../../config';
import { buildEntryPointConfig } from '../../entrypoint';
import { runRendererDevCommand } from '../../renderer';

export interface DevArguments extends Arguments {
    root: string;
    port: string | null;
}

export class DevCommand implements CommandModule {
    command = 'dev';

    describe = 'Run application in dev mode.';

    builder(args: Argv) {
        return args
            .option('root', {
                alias: 'r',
                default: process.cwd(),
                describe: 'Path to your project root directory.',
            })
            .option('port', {
                alias: 'p',
                default: null,
                describe: 'Port of the application server in dev mode.',
            });
    }

    async handler(raw: Arguments) {
        try {
            const args = raw as DevArguments;

            // Project directory
            const baseDirectoryPath = args.root || process.cwd();

            // Config
            const config = useConfig(baseDirectoryPath);

            // Port
            const port = args.port ? parseInt(args.port, 10) : config.port || 9000;
            config.port = port;

            // ----------------------------------------

            let mainProcess: ChildProcess;

            const startMainProcess = () => {
                if (mainProcess) {
                    return;
                }

                mainProcess = spawn('electron', [
                    path.join(config.rootPath, config.entrypointDirectory, 'dist', 'index.js'),
                ], {
                    env: {
                        ...process.env,
                        ELECTRON_MAIN_PORT: `${port}`,
                    },
                    cwd: baseDirectoryPath,
                    detached: false,
                    stdio: 'inherit',
                });

                mainProcess.on('message', (data) => {
                    console.log(data);
                });

                mainProcess.on('error', (e) => {
                    console.log(e);
                });

                mainProcess.on('exit', () => {
                    stopMainProcess();
                });

                mainProcess.unref();
            };

            const stopMainProcess = () : void => {
                if (mainProcess) {
                    mainProcess.kill();
                }

                mainProcess = undefined;
            };

            // ----------------------------------------

            let rendererProcess: ChildProcess;

            const startRendererInstance = () : void => {
                rendererProcess = runRendererDevCommand(config);
            };

            const stopRendererInstance = () : void => {
                if (rendererProcess) {
                    rendererProcess.kill();
                }

                rendererProcess = undefined;
            };

            // ----------------------------------------

            const killAllProcesses = async () => {
                stopMainProcess();
                stopRendererInstance();
            };

            process.on('SIGINT', killAllProcesses);
            process.on('SIGTERM', killAllProcesses);
            process.on('exit', killAllProcesses);

            // ----------------------------------------

            startRendererInstance();

            const devOptions = buildEntryPointConfig('development', config);
            await build(devOptions);

            startMainProcess();
        } catch (e) {
            // eslint-disable-next-line no-console
            console.log(e);

            throw e;
        }
    }
}

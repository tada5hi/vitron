import { Arguments, Argv, CommandModule } from 'yargs';
import { ChildProcess, SpawnSyncOptions } from 'child_process';
import spawn from 'cross-spawn';
import { webpack } from 'webpack';
import { BaseError } from '@typescript-error/core';
import path from 'path';
import { useElectronAdapterConfig } from '../../config';
import { runRendererDevCommand } from '../../renderer';
import { buildEntrypointWebpackConfig } from '../../entrypoint';

export interface DevArguments extends Arguments {
    root: string;
    port: string | '8888';
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
                describe: 'Port to run the application in dev mode.',
            });
    }

    async handler(raw: Arguments) {
        try {
            const args: DevArguments = raw as DevArguments;

            // Project directory
            const baseDirectoryPath = args.root || process.cwd();

            // Config
            const config = useElectronAdapterConfig(baseDirectoryPath);

            // Port
            const port = args.port ? parseInt(args.port, 10) : config.port || 9000;
            config.port = port;

            // ----------------------------------------

            const spawnOptions: SpawnSyncOptions = {
                cwd: baseDirectoryPath,
                stdio: 'inherit',
            };

            let firstCompile = true;
            let watching: any;
            let mainProcess: ChildProcess;
            let rendererInstance: ChildProcess;

            const startMainProcess = () => {
                mainProcess = spawn('electron', [
                    path.join(config.rootPath, config.entrypointDirectory, 'dist', 'index.js'),
                ], {
                    detached: false,
                    env: {
                        ELECTRON_MAIN_PORT: `${port}`,
                    },
                    ...spawnOptions,
                });

                mainProcess.on('error', (e) => {
                    console.log(e);
                });

                mainProcess.on('exit', () => {
                    killWholeProcess();
                });

                mainProcess.unref();
            };

            const startRendererInstance = () : ChildProcess => {
                const child = runRendererDevCommand(config);

                if (typeof child === 'undefined') {
                    throw new BaseError('No renderer process command provided...');
                }

                return child;
            };

            const killWholeProcess = async () => {
                if (watching) {
                    watching.close(() => {
                    });
                }

                if (mainProcess) {
                    mainProcess.kill();
                }

                if (rendererInstance) {
                    rendererInstance.kill();
                }
            };

            process.on('SIGINT', killWholeProcess);
            process.on('SIGTERM', killWholeProcess);
            process.on('exit', killWholeProcess);

            rendererInstance = startRendererInstance();

            const entrypointWebpackConfig = buildEntrypointWebpackConfig('development', baseDirectoryPath);
            const entrypointCompiler = webpack(entrypointWebpackConfig, (err: Error | undefined, stats: any) => {
                if (err) {
                    console.log(err);
                    process.exit(1);
                }
            });

            Promise
                .resolve()
                // eslint-disable-next-line no-promise-executor-return
                .then(() => new Promise(((resolve) => setTimeout(resolve, 5000))))
                .then(() => {
                    watching = entrypointCompiler.watch({}, async (err: any) => {
                        if (err) {
                            // eslint-disable-next-line no-console
                            console.error(err.stack || err);
                            if (err.details) {
                                // eslint-disable-next-line no-console
                                console.error(err.details);
                            }
                        }

                        if (firstCompile) {
                            firstCompile = false;
                        }

                        if (!err) {
                            if (!firstCompile) {
                                if (mainProcess) {
                                    mainProcess.kill();
                                }
                            }

                            startMainProcess();
                        }
                    });
                });
        } catch (e) {
            // eslint-disable-next-line no-console
            console.log(e);

            throw e;
        }
    }
}

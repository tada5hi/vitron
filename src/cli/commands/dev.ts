import { Arguments, Argv, CommandModule } from 'yargs';
import { ChildProcess, SpawnSyncOptions } from 'child_process';
import spawn from 'cross-spawn';
import { webpack } from 'webpack';
import { buildWebpackConfig } from '../../config/webpack';

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
                default: '8888',
                describe: 'Port to run the application in dev mode.',
            });
    }

    async handler(raw: Arguments, exitProcess = true) {
        const args : DevArguments = raw as DevArguments;

        // Project directory
        const baseDirectoryPath = args.root || process.cwd();

        // Port
        const port = parseInt(args.port || '8888', 10);

        // ----------------------------------------

        const spawnOptions: SpawnSyncOptions = {
            cwd: baseDirectoryPath,
            stdio: 'inherit',
        };

        let firstCompile = true;
        let watching: any;
        let mainProcess: ChildProcess;
        let rendererProcess: ChildProcess;

        const startMainProcess = () => {
            mainProcess = spawn('electron', ['.', '--debug'], {
                detached: false,
                env: {
                    ELECTRON_MAIN_PORT: `${port}`,
                },
                ...spawnOptions,
            });

            mainProcess.unref();
        };

        const startRendererProcess = () => {
            const child = spawn('nuxt', ['-p', `${port}`, 'renderer'], spawnOptions);
            child.on('close', () => {
                process.exit(0);
            });
            return child;
        };

        const killWholeProcess = () => {
            if (watching) {
                watching.close(() => {});
            }
            if (mainProcess) {
                mainProcess.kill();
            }
            if (rendererProcess) {
                rendererProcess.kill();
            }
        };

        process.on('SIGINT', killWholeProcess);
        process.on('SIGTERM', killWholeProcess);
        process.on('exit', killWholeProcess);

        rendererProcess = startRendererProcess();

        const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

        await delay(8000);

        const compiler = webpack(buildWebpackConfig('development', baseDirectoryPath));

        watching = compiler.watch({}, async (err: any) => {
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
    }
}

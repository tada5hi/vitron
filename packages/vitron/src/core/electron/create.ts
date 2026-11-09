/*
 * Copyright (c) 2023.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { ChildProcess } from 'node:child_process';
import process from 'node:process';
import kill from 'tree-kill';
import spawn from 'cross-spawn';
import type { Logger } from 'vite';
import type { Config } from '../../config';
import { AppName } from '../../apps/constants';
import { getAppDestinationDirectoryPath } from '../../apps/utils';

type ElectronHandler = {
    start: () => Promise<void>,
    stop: () => Promise<void>,
    restart: () => Promise<void>
    up: () => boolean
};
export function createElectron(
    config: Config,
    logger: Logger,
    onExit?: (code: number | null, signal: NodeJS.Signals | null) => void,
) : ElectronHandler {
    let myProcess : ChildProcess | undefined;
    let stopping: Promise<void> | undefined;
    let restartRequested = false;

    const start = async () : Promise<void> => {
        if (myProcess || stopping) {
            return;
        }

        const child = spawn('electron', [
            getAppDestinationDirectoryPath(config, AppName.MAIN),
        ], {
            cwd: config.get('rootPath'),
            stdio: 'inherit',
        });

        myProcess = child;

        child.on('message', (data) => {
            logger.info(`${data}`);
        });

        let spawned = false;

        const launched = new Promise<void>((resolve, reject) => {
            child.once('spawn', () => {
                spawned = true;
                resolve();
            });
            child.once('error', reject);
            child.once('close', () => reject(new Error('Electron closed before startup.')));
        });

        child.on('error', (e) => {
            logger.error(e.message);
        });

        child.on('close', (code, signal) => {
            if (myProcess === child) {
                myProcess = undefined;
            }

            // `stopping` is set before any requested close and cleared only after it, so it separates the two.
            if (spawned && !stopping) {
                onExit?.(code, signal);
            }
        });

        await launched;
    };

    const stop = () : Promise<void> => {
        restartRequested = false;

        if (stopping) {
            return stopping;
        }

        const child = myProcess;

        if (!child) {
            return Promise.resolve();
        }

        let timer: ReturnType<typeof setTimeout> | undefined;

        stopping = new Promise<void>((resolve, reject) => {
            const forceKill = () => {
                if (child.pid) {
                    kill(child.pid, 'SIGKILL', (error) => {
                        if (error) {
                            reject(error);
                        }
                    });
                } else {
                    child.kill('SIGKILL');
                }
            };

            child.once('close', () => resolve());
            timer = setTimeout(forceKill, 5000);

            if (process.platform === 'win32') {
                forceKill();
            } else {
                // Electron's launcher forwards SIGTERM and waits for its native child to close.
                child.kill('SIGTERM');
            }
        }).finally(() => {
            clearTimeout(timer);
            stopping = undefined;
        });

        return stopping;
    };

    const up = () => typeof myProcess !== 'undefined';

    const restart = async () => {
        const stopped = stop();

        restartRequested = true;
        await stopped;

        if (!restartRequested) {
            return;
        }

        restartRequested = false;
        await start();
    };

    return {
        restart,
        start,
        stop,
        up,
    };
}

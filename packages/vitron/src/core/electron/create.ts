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
    start: () => void,
    stop: () => Promise<void>,
    restart: () => Promise<void>
    up: () => boolean
};
export function createElectron(config: Config, logger: Logger) : ElectronHandler {
    let myProcess : ChildProcess | undefined;
    let stopping: Promise<void> | undefined;
    let restartRequested = false;

    const start = () : void => {
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

        child.on('error', (e) => {
            logger.error(e.message);
        });

        child.on('close', () => {
            if (myProcess === child) {
                myProcess = undefined;
            }
        });
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
        start();
    };

    return {
        restart,
        start,
        stop,
        up,
    };
}

/*
 * Copyright (c) 2023.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { ChildProcess } from 'node:child_process';
import kill from 'tree-kill';
import spawn from 'cross-spawn';
import type { Logger } from 'vite';
import type { Config } from '../../config';
import { AppName } from '../../apps/constants';
import { getAppDestinationDirectoryPath } from '../../apps/utils';

type ElectronHandler = {
    start: () => void,
    stop: () => void,
    restart: () => void
    up: () => boolean
};
export function createElectron(config: Config, logger: Logger) : ElectronHandler {
    let myProcess : ChildProcess | undefined;

    const start = () : void => {
        if (myProcess) {
            return;
        }

        myProcess = spawn('electron', [
            getAppDestinationDirectoryPath(config, AppName.ENTRYPOINT),
        ], {
            cwd: config.get('rootPath'),
            stdio: 'inherit',
        });

        myProcess.on('message', (data) => {
            logger.info(`${data}`);
        });

        myProcess.on('error', (e) => {
            logger.error(e.message);
        });

        myProcess.on('exit', () => {
            stop();
        });
    };

    const stop = () : void => {
        if (myProcess) {
            myProcess.removeAllListeners();

            if (myProcess.pid) {
                kill(myProcess.pid);
            } else {
                myProcess.kill('SIGKILL');
            }
        }

        myProcess = undefined;
    };

    const up = () => typeof myProcess !== 'undefined';

    const restart = () => {
        stop();
        start();
    };

    return {
        restart,
        start,
        stop,
        up,
    };
}

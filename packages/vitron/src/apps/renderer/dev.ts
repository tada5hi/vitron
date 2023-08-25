/*
 * Copyright (c) 2023.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { ChildProcess } from 'node:child_process';
import { createServer } from 'vite';
import type { UserConfig, ViteDevServer } from 'vite';
import type { Config } from '../../config';
import { EnvironmentName } from '../../constants';
import { spawnRendererProcess } from './ps';
import { buildRendererConfig } from './config';

type RendererProcess = {
    start: () => Promise<void>,
    stop: () => Promise<void>,
    restart: () => Promise<void>
    up: () => boolean,
    reload: () => Promise<void>
};
export function createRenderer(config: Config) : RendererProcess {
    let myProcess : ChildProcess | undefined;

    let viteConfig : UserConfig | undefined;
    let viteServer: ViteDevServer | undefined;

    const start = async () : Promise<void> => {
        if (myProcess || viteServer) return;

        myProcess = spawnRendererProcess(config);
        if (myProcess) {
            return;
        }

        if (!viteConfig) {
            viteConfig = await buildRendererConfig(config, EnvironmentName.DEVELOPMENT);
        }
        viteServer = await createServer(viteConfig);

        await viteServer.listen(config.get('port'));
    };

    const stop = async () : Promise<void> => {
        if (myProcess) {
            myProcess.removeAllListeners();
            myProcess.kill();

            myProcess = undefined;

            return;
        }

        if (viteServer) {
            await viteServer.close();
            viteServer = undefined;
        }
    };

    const restart = async () : Promise<void> => {
        if (myProcess) {
            await stop();
            await start();
        }

        if (viteServer) {
            await viteServer.restart();
        }
    };

    const up = () => typeof myProcess !== 'undefined' || typeof viteServer !== 'undefined';

    const reload = async () : Promise<void> => {
        if (viteServer) {
            viteServer.ws.send({ type: 'full-reload' });
        } else {
            await restart();
        }
    };

    return {
        restart,
        start,
        stop,
        up,
        reload,
    };
}

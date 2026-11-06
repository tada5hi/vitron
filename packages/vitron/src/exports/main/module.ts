/*
 * Copyright (c) 2023.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { createServer } from 'node:http';
import { once } from 'node:events';
import process from 'node:process';
import path from 'node:path';
import { app } from 'electron';
import { createHandler } from '@routup/static';
import { Router, createNodeDispatcher } from 'routup';
import type { BrowserWindow } from 'electron';
import type { ServeOptions } from './types';

export async function serve(
    mainWindow: BrowserWindow,
    options: ServeOptions,
) : Promise<void> {
    if (!app.isPackaged) {
        await mainWindow.loadURL(`http://localhost:${options.port || 9000}`);

        return;
    }

    const router = new Router();

    let defaultDirectory: string;

    if (process.platform === 'win32') {
        defaultDirectory = path.join(process.cwd(), 'app.asar', '.vitron', 'renderer');
    } else {
        defaultDirectory = '.vitron/renderer';
    }

    router.use('/', createHandler(options.directory || defaultDirectory));

    const server = createServer(createNodeDispatcher(router));

    const stop = async () => new Promise<void>((resolve, reject) => {
        if (!server.listening) {
            resolve();

            return;
        }

        server.close((err) => {
            if (err) {
                reject(err);

                return;
            }

            resolve();
        });
    });

    mainWindow.on('closed', () => stop());

    server.listen(0, '127.0.0.1');
    await once(server, 'listening');

    const address = server.address();

    if (!address || typeof address === 'string') {
        await stop();

        throw new Error('The renderer server did not bind a TCP port.');
    }

    try {
        await mainWindow.loadURL(`http://127.0.0.1:${address.port}`);
    } catch (error) {
        await stop();

        throw error;
    }
}

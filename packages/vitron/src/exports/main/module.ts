/*
 * Copyright (c) 2023.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { realpath, stat } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { once } from 'node:events';
import process from 'node:process';
import path from 'node:path';
import { app } from 'electron';
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

    const {
        App,
        defineCoreHandler,
        sendFile,
        toNodeHandler,
    } = await import('routup/node');
    const router = new App();

    let defaultDirectory: string;

    if (process.platform === 'win32') {
        defaultDirectory = path.join(process.cwd(), 'app.asar', '.vitron', 'renderer');
    } else {
        defaultDirectory = '.vitron/renderer';
    }

    const directory = await realpath(options.directory || defaultDirectory);
    const visible = (relative: string) => relative.split(path.sep).every((part, index) => (
        !part.startsWith('.') || (index === 0 && part === '.well-known')
    ));

    router.use(defineCoreHandler(async (event) => {
        let requestPath: string;

        try {
            requestPath = decodeURIComponent(event.path);
        } catch {
            return event.next();
        }

        if (requestPath.includes('\\') || requestPath.includes('\0') || !visible(requestPath.slice(1).split('/').join(path.sep))) {
            return event.next();
        }

        const filePath = path.resolve(directory, `.${requestPath}`);
        const candidates = requestPath.endsWith('/') ? [] : [filePath];

        if (!path.extname(filePath)) {
            candidates.push(`${filePath}.html`, `${filePath}.htm`);
        }

        candidates.push(path.join(filePath, 'index.html'), path.join(filePath, 'index.htm'));

        for (const candidate of candidates) {
            try {
                const resolved = await realpath(candidate);
                const relative = path.relative(directory, resolved);

                // Resolve symlinks before checking confinement, including sibling-prefix paths.
                if (path.isAbsolute(relative) || !visible(relative)) {
                    continue;
                }

                const stats = await stat(resolved);

                if (stats.isFile()) {
                    const etag = `W/"${stats.size}-${stats.mtime.getTime()}"`;

                    event.response.headers.set('cache-control', 'public,max-age=0,must-revalidate');
                    event.response.headers.set('etag', etag);

                    if (event.headers.get('if-none-match') === etag) {
                        return new Response(null, { status: 304, headers: event.response.headers });
                    }

                    const range = event.headers.get('range');

                    // routup only interprets single explicit byte intervals correctly.
                    if (range && !/^bytes=\d+-\d*$/.test(range)) {
                        event.headers.delete('range');
                    }

                    return sendFile(event, {
                        name: candidate,
                        stats,
                        content: (range) => (event.method === 'HEAD' ?
                            new Uint8Array() :
                            Readable.toWeb(createReadStream(resolved, { ...range, signal: event.signal }))),
                    });
                }
            } catch (error) {
                if (!['ENOENT', 'ENOTDIR', 'EACCES'].includes((error as NodeJS.ErrnoException).code || '')) {
                    throw error;
                }
            }
        }

        return event.next();
    }));

    const server = createServer(toNodeHandler(router));

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

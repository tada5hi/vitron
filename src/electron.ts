/*
 * Copyright (c) 2021-2021.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import path from 'path';
import electron from 'electron';
import { promisify } from 'util';
import { URL } from 'url';
import * as fs from 'fs';
import { RegisterRenderedFilesContext } from './type';

export async function getRendererPath(path_: string) : Promise<string> {
    try {
        const result = await promisify(fs.stat)(path_);

        if (result.isFile()) {
            return path_;
        }

        if (result.isDirectory()) {
            return await getRendererPath(path.join(path_, 'index.html'));
        }
    } catch (_) {
        // ...
    }

    return undefined;
}

export function registerRenderedFiles(
    options: RegisterRenderedFilesContext,
) {
    options = {
        ...options,
        isCorsEnabled: true,
        scheme: 'app',
    };

    if (!options.directory) {
        throw new Error('The `directory` option is required');
    }

    options.directory = path.resolve(electron.app.getAppPath(), options.directory);

    const handler = async (
        request: Electron.ProtocolRequest,
        callback: (response: (string | Electron.ProtocolResponse)) => void,
    ) => {
        const indexPath = path.join(options.directory, 'index.html');
        const filePath = path.join(options.directory, decodeURIComponent(new URL(request.url).pathname));
        const resolvedPath = await getRendererPath(filePath);
        const fileExtension = path.extname(filePath);

        if (resolvedPath || !fileExtension || fileExtension === '.html' || fileExtension === '.asar') {
            callback({
                path: resolvedPath || indexPath,
            });
        } else {
            callback({ error: -6 });
        }
    };

    electron.protocol.registerSchemesAsPrivileged([
        {
            scheme: options.scheme,
            privileges: {
                standard: true,
                secure: true,
                allowServiceWorkers: true,
                supportFetchAPI: true,
                corsEnabled: options.isCorsEnabled,
            },
        },
    ]);

    electron.app.on('ready', () => {
        const session = options.partition ?
            electron.session.fromPartition(options.partition) :
            electron.session.defaultSession;

        session.protocol.registerFileProtocol(options.scheme, handler);
    });
}

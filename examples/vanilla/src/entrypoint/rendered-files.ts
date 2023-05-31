/*
 * Copyright (c) 2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import path from 'node:path';
import electron from 'electron';
import { URL } from 'node:url';
import fs from 'node:fs';

export type RegisterRenderedFilesContext = {
    isCorsEnabled: boolean,
    scheme: string
    directory: string,
    partition?: string
};

export type RegisterRenderedFilesContextInput = {
    isCorsEnabled?: boolean,
    scheme?: string
    directory: string,
    partition?: string
};

export async function getRendererPath(input: string) : Promise<string | undefined> {
    try {
        const result = await fs.promises.stat(input);

        if (result.isFile()) {
            return input;
        }

        if (result.isDirectory()) {
            return await getRendererPath(path.join(input, 'index.html'));
        }
    } catch (_) {
        // ...
    }

    return undefined;
}

export function registerRenderedFiles(
    input: RegisterRenderedFilesContextInput,
) {
    const options : RegisterRenderedFilesContext = {
        isCorsEnabled: true,
        scheme: 'app',
        ...input,
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
            scheme: options.scheme || 'app',
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

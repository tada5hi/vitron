/*
 * Copyright (c) 2023-2023.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const extensions = [
    '.js',
    '.cjs',
    '.mjs',
    '.ts',
    '.cts',
    '.mts',
];

export async function findEntryFile(root?: string, fileNames?: string[]) : Promise<string | undefined> {
    const names : string[] = [
        'index',
        ...(fileNames || []),
    ];
    for (let i = 0; i < extensions.length; i++) {
        for (let j = 0; j < names.length; j++) {
            const checkPath = path.resolve(root || process.cwd(), `${names[j]}${extensions[i]}`);

            try {
                await fs.promises.access(checkPath, fs.constants.F_OK | fs.constants.R_OK);
                return checkPath;
            } catch (e) {
                // continue ^^
            }
        }
    }

    return undefined;
}

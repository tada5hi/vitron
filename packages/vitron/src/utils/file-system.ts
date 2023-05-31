/*
 * Copyright (c) 2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import fs from 'node:fs';
import path from 'node:path';

export async function ensureDirectoryExists(input: string) : Promise<void> {
    if (!path.isAbsolute(input)) {
        input = path.join(process.cwd(), input);
    }

    try {
        await fs.promises.access(input, fs.constants.R_OK | fs.constants.O_DIRECTORY);
    } catch (e) {
        await fs.promises.mkdir(input, { recursive: true });
    }
}

export async function ensureDirectoryNotExists(input: string) : Promise<void> {
    if (!path.isAbsolute(input)) {
        input = path.join(process.cwd(), input);
    }

    try {
        await fs.promises.access(input, fs.constants.R_OK | fs.constants.O_DIRECTORY);
        await fs.promises.rm(input, { recursive: true });
    } catch (e) {
        // do nothing
    }
}

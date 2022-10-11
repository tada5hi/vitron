/*
 * Copyright (c) 2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import fs from 'fs-extra';
import path from 'path';

export async function createRecursiveDirectory(input: string) {
    if (!path.isAbsolute(input)) {
        input = path.join(process.cwd(), input);
    }

    try {
        await fs.promises.access(input);
    } catch (e) {
        await fs.promises.mkdir(input, { recursive: true });
    }
}

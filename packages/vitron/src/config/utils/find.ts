/*
 * Copyright (c) 2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { merge } from 'smob';
import type { OptionsInput } from '../types';

export async function loadOptions(path?: string) : Promise<OptionsInput> {
    const { read, locateMany } = await import('locter');
    const items : OptionsInput[] = [];

    const fileInfos = await locateMany('vitron.config.{ts,cts,mts,cjs,mjs,js,json}', { cwd: path });

    for (const fileInfo of fileInfos) {
        const data = await read(fileInfo);

        if (data.default) {
            items.push(data.default);

            continue;
        }

        items.push(data);
    }

    return merge({}, ...items);
}

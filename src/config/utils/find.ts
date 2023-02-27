/*
 * Copyright (c) 2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { getExportItem, load, locateMany } from 'locter';
import { merge } from 'smob';
import { ConfigInput } from '../../type';

export async function findConfig(directoryPath?: string) : Promise<ConfigInput> {
    directoryPath ??= process.cwd();

    const items : ConfigInput[] = [];

    const fileInfos = await locateMany('vitron.config.{ts,js,json}', {
        path: directoryPath,
    });

    for (let i = 0; i < fileInfos.length; i++) {
        const data = await load(fileInfos[i]);
        const fileExport = getExportItem(data);
        if (fileExport.key === 'default') {
            items.push(fileExport.value);
        }
    }

    return merge({}, ...items);
}

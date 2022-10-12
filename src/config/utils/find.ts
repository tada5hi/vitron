/*
 * Copyright (c) 2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { loadScriptFileExport, locateFiles } from 'locter';
import { merge } from 'smob';
import { ConfigInput } from '../../type';

export async function findConfig(directoryPath?: string) : Promise<ConfigInput> {
    directoryPath ??= process.cwd();

    const items : ConfigInput[] = [];

    const fileInfos = await locateFiles('vitron.config.{ts,js,json}', {
        path: directoryPath,
    });

    for (let i = 0; i < fileInfos.length; i++) {
        const fileExport = await loadScriptFileExport(fileInfos[i]);
        if (fileExport.key === 'default') {
            items.push(fileExport.value);
        }
    }

    return merge({}, ...items);
}

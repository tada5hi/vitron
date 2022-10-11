/*
 * Copyright (c) 2021.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import path from 'path';
import fs from 'fs-extra';
import { Config } from '../type';
import { extendConfig } from './utils';

export function useConfig(directoryPath: string) : Config {
    const filePath : string = path.join(directoryPath, 'vitron.config.js');

    if (!fs.existsSync(filePath)) {
        return extendConfig({}, directoryPath);
    }

    // todo: validation required
    // eslint-disable-next-line global-require,import/no-dynamic-require,@typescript-eslint/no-var-requires
    const config : Config = require(filePath);

    return extendConfig(config, directoryPath);
}

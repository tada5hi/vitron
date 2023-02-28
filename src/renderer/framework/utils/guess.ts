/*
 * Copyright (c) 2023-2023.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { loadSync } from 'locter';
import path from 'node:path';
import fs from 'node:fs';
import { hasOwnProperty } from 'smob';
import { Framework } from '../constants';
import type { FrameworkInfo } from '../type';

export function detectFramework(rootPath?: string) : FrameworkInfo | undefined {
    if (typeof rootPath === 'undefined') {
        rootPath = process.cwd();
    } else if (!path.isAbsolute(rootPath)) {
        rootPath = path.join(process.cwd(), rootPath);
    }

    const packageJsonFilePath = path.join(rootPath, 'package.json');

    if (!fs.existsSync(packageJsonFilePath)) {
        return undefined;
    }

    const { dependencies, devDependencies, peerDependencies } = loadSync(packageJsonFilePath);

    const dependencyMap : Record<string, string> = {
        ...(dependencies || {}),
        ...(devDependencies || {}),
        ...(peerDependencies || {}),
    };

    if (
        hasOwnProperty(dependencyMap, Framework.NUXT)
    ) {
        return {
            name: Framework.NUXT,
            version: `${dependencyMap[Framework.NUXT]}`,
        };
    }

    if (hasOwnProperty(dependencyMap, Framework.NEXT)) {
        return {
            name: Framework.NEXT,
            version: `${dependencyMap[Framework.NEXT]}`,
        };
    }

    return undefined;
}

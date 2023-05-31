/*
 * Copyright (c) 2023-2023.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { loadSync } from 'locter';
import path from 'node:path';
import fs from 'node:fs';
import { hasOwnProperty, isObject } from 'smob';
import { removePackageVersionCaret } from '../../package';
import type { PackageInfo } from '../../package';
import { Framework } from '../constants';

function parsePackageJSONOutput(input: unknown) {
    if (!isObject(input)) {
        return undefined;
    }

    const { dependencies, devDependencies, peerDependencies } = input;

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
            version: removePackageVersionCaret(`${dependencyMap[Framework.NUXT]}`),
        };
    }

    if (hasOwnProperty(dependencyMap, Framework.NEXT)) {
        return {
            name: Framework.NEXT,
            version: removePackageVersionCaret(`${dependencyMap[Framework.NEXT]}`),
        };
    }

    return undefined;
}

function buildPackageJSONPath(rootPath?: string) {
    if (typeof rootPath === 'undefined') {
        rootPath = process.cwd();
    } else if (!path.isAbsolute(rootPath)) {
        rootPath = path.join(process.cwd(), rootPath);
    }

    return path.join(rootPath, 'package.json');
}

export function detectFrameworkSync(rootPath?: string) : PackageInfo | undefined {
    const packageJsonFilePath = buildPackageJSONPath(rootPath);

    if (!fs.existsSync(packageJsonFilePath)) {
        return undefined;
    }

    const packageJson = loadSync(packageJsonFilePath);

    return parsePackageJSONOutput(packageJson);
}

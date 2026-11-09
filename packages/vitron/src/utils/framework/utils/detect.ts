/*
 * Copyright (c) 2023-2023.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import path from 'node:path';
import fs from 'node:fs';
import { findPackageJSON } from 'node:module';
import { readSync } from 'locter';
import { hasOwnProperty, isObject } from 'smob';
import { removePackageVersionCaret } from '../../package';
import type { PackageInfo } from '../../package';
import { Framework } from '../constants';

function parsePackageJSONOutput(input: unknown, packageJsonFilePath: string) {
    if (!isObject(input)) {
        return undefined;
    }

    const {
        dependencies,
        devDependencies,
        peerDependencies,
    } = input;

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
            // Without an installed manifest the declared range proves nothing, so the support check reports it.
            version: installedNextVersion(packageJsonFilePath) ?? 'unknown',
        };
    }

    return undefined;
}

// The declared range (`latest`, `~16.0.0`) says little; the installed manifest holds the real version.
function installedNextVersion(packageJsonFilePath: string) : string | undefined {
    try {
        const manifestPath = findPackageJSON(Framework.NEXT, packageJsonFilePath);

        if (!manifestPath) {
            return undefined;
        }

        const { version } = readSync(manifestPath);

        return typeof version === 'string' ? version : undefined;
    } catch {
        return undefined;
    }
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

    const packageJson = readSync(packageJsonFilePath);

    return parsePackageJSONOutput(packageJson, packageJsonFilePath);
}

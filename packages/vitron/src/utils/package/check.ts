/*
 * Copyright (c) 2023.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { isObject } from 'smob';
import semver from 'semver';
import type { PackageInfo } from './types';
import { removePackageVersionCaret } from './utils';

export function isValidPackageVersion(input: unknown) : boolean {
    if (typeof input !== 'string') {
        return false;
    }

    return !!semver.valid(removePackageVersionCaret(input));
}

export function isPackageNameWithVersion(input: string) : boolean {
    const index = input.indexOf('@');

    return index > 0 && isValidPackageVersion(input.substring(index + 1));
}

export function isPackageInfo(input: unknown) : input is PackageInfo {
    if (!isObject(input) || typeof input.name !== 'string' || typeof input.version !== 'string') {
        return false;
    }

    return isValidPackageVersion(input.version);
}

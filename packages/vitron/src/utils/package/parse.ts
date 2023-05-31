/*
 * Copyright (c) 2023-2023.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { PackageInfo } from './type';
import { removePackageVersionCaret } from './utils';

export function parsePackageNameWithVersion(input: string) : PackageInfo {
    const [
        name,
        version,
    ] = input.split('@');

    if (!version) {
        throw new SyntaxError('The package version is missing in the input string.');
    }

    return {
        name,
        version: removePackageVersionCaret(version),
    };
}

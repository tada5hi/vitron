/*
 * Copyright (c) 2023.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

export function removePackageVersionCaret(input: string) {
    const caret = input.substring(0, 1);
    return caret === '^' ? input.substring(1) : input;
}

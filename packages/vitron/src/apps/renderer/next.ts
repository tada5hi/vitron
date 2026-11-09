/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import semver from 'semver';
import type { Config } from '../../config';
import { Framework } from '../../utils';

export function assertSupportedNext(config: Config): void {
    const framework = config.get('framework') as { name?: unknown, version?: unknown } | string | undefined;

    if (!framework || typeof framework !== 'object' || framework.name !== Framework.NEXT) {
        return;
    }

    const version = typeof framework.version === 'string' ? semver.valid(framework.version) : null;

    if (!version) {
        throw new Error('Could not determine the Next.js version. Install next in this project.');
    }

    if (semver.lt(version, '14.0.0')) {
        throw new Error(`Vitron requires Next.js 14 or newer, found ${version}.`);
    }
}

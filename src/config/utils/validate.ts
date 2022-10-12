/*
 * Copyright (c) 2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import zod from 'zod';
import { Environment, Framework } from '../../constants';
import { ConfigInput } from '../../type';

const configValidation = zod.object({
    env: zod.nativeEnum(Environment),
    port: zod.number(),
    rootPath: zod.string(),

    framework: zod.nativeEnum(Framework),

    buildDirectory: zod.string(),

    entrypointDirectory: zod.string(),
    entrypointConfig: zod.any().optional(),

    rendererDirectory: zod.string(),
    renderBuildPaths: zod.union([
        zod.string(),
        zod.array(zod.string()),
    ]),
    rendererBuildCommand: zod.function().returns(zod.any()).optional(),
    rendererDevCommand: zod.function().returns(zod.any()).optional(),
    rendererConfig: zod.any().optional(),
});

export function validateConfig(input: unknown) : ConfigInput {
    return configValidation.partial().parse(input);
}

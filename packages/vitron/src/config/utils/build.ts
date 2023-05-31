/*
 * Copyright (c) 2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { Continu } from 'continu';
import { loadSync } from 'locter';
import * as process from 'process';
import { merge } from 'smob';
import zod from 'zod';
import path from 'node:path';
import { EnvironmentName } from '../../constants';
import {
    Framework,
    detectFrameworkSync,
    isPackageInfo,
    isPackageNameWithVersion,
    parsePackageNameWithVersion, removePackageVersionCaret,
} from '../../utils';

import type { PackageInfo } from '../../utils';
import type { Config, Options, OptionsInput } from '../type';
import { extractConfigFromEnv } from './env';

export function buildConfig(input: OptionsInput) : Config {
    const raw = merge(extractConfigFromEnv(), input);

    const instance = new Continu<Options, OptionsInput>({
        defaults: {
            port: 9000,
            rootPath: process.cwd(),
            buildDirectory: 'dist',
            rendererDirectory: 'src/renderer',
            rendererBuildDirectory: ['dist'],
            entrypointDirectory: 'src/entrypoint',
        },
        transformers: {
            rootPath: (input) => {
                if (typeof input !== 'string') {
                    return process.cwd();
                }

                return path.isAbsolute(input) ? `${input}` : path.join(process.cwd(), `${input}`);
            },
            framework: (input) => {
                if (isPackageInfo(input)) {
                    return input;
                }

                if (typeof input === 'string') {
                    if (isPackageNameWithVersion(input)) {
                        return parsePackageNameWithVersion(input);
                    }

                    const directoryPath = path.dirname(require.resolve(input));
                    const packageJson = loadSync(path.join(directoryPath, 'package.json'));

                    return {
                        name: input,
                        version: removePackageVersionCaret(`${packageJson.version}`),
                    } as PackageInfo;
                }

                return undefined;
            },
            rendererBuildDirectory: (input) => {
                if (!Array.isArray(input)) {
                    return [input];
                }

                return input;
            },
        },
        validators: {
            env: (value) => zod.nativeEnum(EnvironmentName).safeParse(value),
            port: (value) => zod.number().safeParse(value),
            rootPath: (value) => zod.string().safeParse(value),

            framework: (value) => zod.nativeEnum(Framework).or(zod.object({
                name: zod.nativeEnum(Framework),
                version: zod.string(),
            })).safeParse(value),

            buildDirectory: (value) => zod.string().safeParse(value),

            entrypointDirectory: (value) => zod.string().safeParse(value),
            entrypointConfig: (value) => zod.any().optional().safeParse(value),

            rendererDirectory: (value) => zod.string().safeParse(value),
            rendererBuildDirectory: (value) => zod.array(zod.string()).safeParse(value),
            rendererBuildCommand: (value) => zod.function().returns(zod.any()).optional().safeParse(value),
            rendererDevCommand: (value) => zod.function().returns(zod.any()).optional().safeParse(value),
            rendererConfig: (value) => zod.any().optional().safeParse(value),
        },
    });

    instance.setRaw(raw);

    if (!instance.has('framework')) {
        const framework = detectFrameworkSync(instance.get('rootPath'));
        if (framework) {
            instance.set('framework', framework);
        }
    }

    return instance;
}

/*
 * Copyright (c) 2021-2023.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import fs from 'node:fs';
import path from 'node:path';
import type { SpawnOptions, SpawnSyncReturns } from 'node:child_process';
import spawn from 'cross-spawn';
import semver from 'semver';
import { build } from 'vite';
import type { Config } from '../../config';
import { EnvironmentName } from '../../constants';
import { Framework, isPackageInfo } from '../../utils';
import { moveAppRendererDirectory } from './move';
import { buildRendererConfig } from './config';
import { assertSupportedNext } from './next';

function assertRendererBuildResult(result: SpawnSyncReturns<Buffer>, command: string): void {
    if (result.error) {
        throw result.error;
    }

    if (result.status !== 0) {
        throw new Error(`${command} exited with status ${result.status}${result.signal ? ` (${result.signal})` : ''}.`);
    }
}

export async function buildRendererApp(config: Config): Promise<void> {
    const execOptions: SpawnOptions = {
        cwd: config.get('rootPath'),
        stdio: 'inherit',
        detached: false,
    };

    const command = config.get('rendererBuildCommand');

    if (command) {
        const commandLine = command(config.get());

        assertRendererBuildResult(spawn.sync(commandLine, {
            shell: true,
            cwd: config.get('rootPath'),
            stdio: 'inherit',
        }), commandLine);
        await moveAppRendererDirectory(config);

        return;
    }

    assertSupportedNext(config);

    const framework = config.get('framework');

    if (isPackageInfo(framework)) {
        switch (framework.name) {
            case Framework.NUXT: {
                if (semver.gte(framework.version, '3.0.0')) {
                    assertRendererBuildResult(spawn.sync('nuxi', ['build', config.get('rendererDirectory')], execOptions), 'nuxi build');
                    assertRendererBuildResult(spawn.sync('nuxi', ['generate', config.get('rendererDirectory')], execOptions), 'nuxi generate');
                } else {
                    assertRendererBuildResult(spawn.sync('nuxt', ['build', config.get('rendererDirectory')], execOptions), 'nuxt build');
                    assertRendererBuildResult(spawn.sync('nuxt', ['generate', config.get('rendererDirectory')], execOptions), 'nuxt generate');
                }

                break;
            }
            case Framework.NEXT: {
                const rendererPath = path.resolve(config.get('rootPath'), config.get('rendererDirectory'));
                const outputPath = path.resolve(rendererPath, config.get('rendererBuildDirectory'));
                const indexPath = path.join(outputPath, 'index.html');

                // Only an earlier export is cleared, judged on real paths so a symlink cannot lead the removal out of the renderer.
                if (fs.existsSync(indexPath)) {
                    const relativeOutput = path.relative(fs.realpathSync(rendererPath), fs.realpathSync(outputPath));
                    const insideRenderer = relativeOutput !== '' &&
                        relativeOutput !== '..' &&
                        !relativeOutput.startsWith(`..${path.sep}`) &&
                        !path.isAbsolute(relativeOutput);

                    if (insideRenderer) {
                        fs.rmSync(outputPath, { recursive: true, force: true });
                    }
                }

                // Output that could not be cleared must at least be rewritten, or a leftover index.html would get packaged.
                const previous = fs.statSync(indexPath, { throwIfNoEntry: false })?.mtimeMs;

                assertRendererBuildResult(spawn.sync('next', ['build', config.get('rendererDirectory')], execOptions), 'next build');

                const current = fs.statSync(indexPath, { throwIfNoEntry: false })?.mtimeMs;

                if (current === undefined || current === previous) {
                    throw new Error(`next build produced no ${indexPath}. Set output: 'export' and distDir to match rendererBuildDirectory in the Next config.`);
                }

                break;
            }
        }

        await moveAppRendererDirectory(config);

        return;
    }

    const viteConfig = await buildRendererConfig(config, EnvironmentName.PRODUCTION);

    await build(viteConfig);
}

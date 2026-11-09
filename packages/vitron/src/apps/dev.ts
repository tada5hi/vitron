/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { InlineConfig, Logger } from 'vite';
import type { Config } from '../config';
import { buildWithWatchHook, createElectron } from '../core';
import type { ViteWatchHook } from '../core';
import { buildMainConfig } from './main';
import { buildPreloadConfig } from './preload';
import { createRenderer } from './renderer';
import { assertSupportedNext } from './renderer/next';
import { clearBuildDirectory, createBuildDirectory } from './utils';

export async function runDevelopmentSession(
    config: Config,
    logger: Logger,
    signal: AbortSignal,
) : Promise<void> {
    // A fatal error aborts through the controller; `session.reason` keeps whichever came first.
    const controller = new AbortController();
    const session = AbortSignal.any([signal, controller.signal]);
    const aborted = new Promise<void>((resolve) => {
        if (session.aborted) {
            resolve();
        } else {
            session.addEventListener('abort', () => resolve(), { once: true });
        }
    });

    const cleanups: (() => Promise<unknown>)[] = [];
    const cleanExit = new Error('Electron exited.');
    const electron = createElectron(config, logger, (code, exitSignal) => {
        controller.abort(code === 0 ? cleanExit : new Error(`Electron exited unexpectedly (${code === null ? `signal ${exitSignal}` : `exit code ${code}`}).`));
    });
    const renderer = createRenderer(config);
    let reactions: Promise<unknown> = Promise.resolve();

    // The watcher only logs a rejecting event listener, so a reaction reports failure by aborting.
    const reactTo = (up: () => boolean, react: () => Promise<void>) : ViteWatchHook => () => {
        if (session.aborted || !up()) {
            return undefined;
        }

        const reaction = react().catch((error) => controller.abort(error));

        reactions = Promise.all([reactions, reaction]);

        return reaction;
    };

    const watch = async (viteConfig: InlineConfig, hook: ViteWatchHook) => {
        session.throwIfAborted();

        const watcher = buildWithWatchHook(viteConfig, hook);

        cleanups.push(watcher.close);

        await Promise.race([watcher.ready, aborted]);
        session.throwIfAborted();
    };

    const start = async () => {
        if (!config.get('rendererDevCommand')) {
            assertSupportedNext(config);
        }

        await clearBuildDirectory(config);
        await createBuildDirectory(config);

        await watch(await buildMainConfig(config), reactTo(electron.up, electron.restart));

        const preloadConfig = await buildPreloadConfig(config);

        if (preloadConfig) {
            await watch(preloadConfig, reactTo(renderer.up, () => renderer.reload(session)));
        }

        session.throwIfAborted();

        cleanups.push(renderer.stop);
        await renderer.start(session);

        cleanups.push(() => reactions);
        session.throwIfAborted();

        cleanups.push(electron.stop);
        await electron.start();
    };

    // After an abort a late startup rejection cannot replace `session.reason`, so it reads as cancellation.
    const startup = start().catch((error) => controller.abort(error));

    await aborted;
    await startup;

    const errors: unknown[] = session.reason === signal.reason || session.reason === cleanExit ? [] : [session.reason];

    for (const cleanup of cleanups.reverse()) {
        try {
            await cleanup();
        } catch (error) {
            errors.push(error);
        }
    }

    if (errors.length > 1) {
        throw new AggregateError(errors, 'The development session failed and its cleanup was incomplete.');
    }

    if (errors.length === 1) {
        throw errors[0];
    }
}

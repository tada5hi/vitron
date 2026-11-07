import type { Logger } from 'vite';
import type { Config } from '../config';
import { buildWithWatchHook, createElectron } from '../core';
import type { ViteWatchBuild } from '../core';
import { buildMainConfig } from './main/config';
import { buildPreloadConfig } from './preload/config';
import { createRenderer } from './renderer/dev';
import { clearBuildDirectory, createBuildDirectory } from './utils';

export async function runDevelopmentSession(config: Config, logger: Logger, signal: AbortSignal): Promise<void> {
    const electron = createElectron(config, logger);
    const renderer = createRenderer(config);
    const cancellation = new AbortController();
    let finish!: () => void;
    const finished = new Promise<void>((resolve) => {
        finish = resolve;
    });
    const watchers: ViteWatchBuild[] = [];
    const reactions = new Set<Promise<void>>();
    let stopping = false;
    let running = false;
    let failed = false;
    let failure: unknown;

    const stop = () => {
        stopping = true;
        cancellation.abort();
        finish();
    };
    const fail = (error: unknown) => {
        if (!failed) {
            failed = true;
            failure = error;
        }

        stop();
    };
    const observe = (operation: () => Promise<void>) => async () => {
        if (stopping || !running) {
            return;
        }

        const reaction = operation().catch((error: unknown) => {
            if (!cancellation.signal.aborted || error !== cancellation.signal.reason) {
                fail(error);
            }
        });

        reactions.add(reaction);

        try {
            await reaction;
        } finally {
            reactions.delete(reaction);
        }
    };

    signal.addEventListener('abort', stop, { once: true });

    if (signal.aborted) {
        stop();
    }

    const startup = (async () => {
        cancellation.signal.throwIfAborted();

        await clearBuildDirectory(config);

        cancellation.signal.throwIfAborted();

        await createBuildDirectory(config);

        cancellation.signal.throwIfAborted();

        const mainConfig = await buildMainConfig(config);

        cancellation.signal.throwIfAborted();

        const main = buildWithWatchHook(mainConfig, observe(async () => {
            if (electron.up()) {
                await electron.restart();
            }
        }));

        watchers.push(main);
        await main.ready;

        cancellation.signal.throwIfAborted();

        const preloadConfig = await buildPreloadConfig(config);

        cancellation.signal.throwIfAborted();

        if (preloadConfig) {
            const preload = buildWithWatchHook(preloadConfig, observe(async () => {
                if (renderer.up()) {
                    await renderer.reload();
                }
            }));

            watchers.push(preload);
            await preload.ready;
        }

        cancellation.signal.throwIfAborted();

        await renderer.start(cancellation.signal);

        cancellation.signal.throwIfAborted();

        await electron.start();
        running = !stopping;
    })().catch((error: unknown) => {
        if (!cancellation.signal.aborted || error !== cancellation.signal.reason) {
            fail(error);
        }
    });

    try {
        await finished;

        // Stop adapters promptly to cancel restarts before waiting for watch callbacks.
        const cleanup = await Promise.allSettled([
            electron.stop(),
            renderer.stop(),
            ...watchers.map((watcher) => watcher.close()),
        ]);

        await startup;
        await Promise.all(reactions);

        const errors = cleanup.flatMap((result) => (result.status === 'rejected' ? [result.reason] : []));

        if (failed) {
            errors.unshift(failure);
        }

        if (errors.length === 1) {
            throw errors[0];
        }

        if (errors.length > 1) {
            throw new AggregateError(errors, 'Development session failed.', { cause: failure });
        }
    } finally {
        signal.removeEventListener('abort', stop);
    }
}

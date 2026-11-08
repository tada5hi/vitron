import { EventEmitter } from 'node:events';
import {
    mkdtemp,
    readFile,
    rm,
    writeFile,
} from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { InlineConfig, Rollup } from 'vite';
import * as vite from 'vite';
import {
    afterEach,
    beforeEach,
    expect,
    it,
    vi,
} from 'vitest';
import { buildWithWatchHook } from '../../../src/core/vite/build';

vi.mock('vite', async (importOriginal) => {
    const actual = await importOriginal<typeof vite>();

    return { ...actual, build: vi.fn(actual.build) };
});

const realBuild = (await vi.importActual<typeof vite>('vite')).build;
const watchers = new Set<Rollup.RollupWatcher>();
const directories: string[] = [];

beforeEach(() => {
    vi.mocked(vite.build).mockImplementation(async (config) => {
        const result = await realBuild(config);

        if ('close' in result) {
            watchers.add(result);
        }

        return result;
    });
});

afterEach(async () => {
    await Promise.all([...watchers].map((watcher) => watcher.close()));
    watchers.clear();
    await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
    vi.mocked(vite.build).mockReset();
});

async function fixture(source: string) {
    const root = await mkdtemp(join(tmpdir(), 'vitron-watch-'));

    directories.push(root);

    const entry = join(root, 'entry.js');

    await writeFile(entry, source);

    const config: InlineConfig = {
        root,
        configFile: false,
        logLevel: 'silent',
        build: {
            // Keep edits from rebuild hooks outside Chokidar's 50 ms change throttle.
            watch: { buildDelay: 100 },
            minify: false,
            lib: {
                entry,
                formats: ['es'],
                fileName: 'entry',
            },
        },
    };

    return {
        root,
        entry,
        config,
    };
}

it.each([true, false])('rejects readiness when Vite initialization fails (watch=%s)', async (watch) => {
    const failure = new Error('initialization failed');

    vi.mocked(vite.build).mockRejectedValueOnce(failure);

    const handle = buildWithWatchHook({ build: { watch: watch ? {} : null } }, () => {});

    try {
        await expect(handle.ready).rejects.toBe(failure);
    } finally {
        await handle.close();
    }
});

it.each(['BUNDLE_END', 'ERROR'])('closes a watcher acquired after cancellation on %s and settles readiness', async (code) => {
    const acquisition = Promise.withResolvers<Rollup.RollupWatcher>();
    const cleanup = Promise.withResolvers<void>();
    const close = vi.fn(() => cleanup.promise);
    const watcher = Object.assign(new EventEmitter(), { close }) as unknown as EventEmitter & Rollup.RollupWatcher;

    vi.mocked(vite.build).mockReturnValueOnce(acquisition.promise);

    const handle = buildWithWatchHook({ build: { watch: {} } }, () => {});

    try {
        expect(handle.close).toBeTypeOf('function');

        const firstClose = handle.close();
        const secondClose = handle.close();

        expect(secondClose).toBe(firstClose);

        let closed = false;

        void firstClose.then(() => {
            closed = true;
        });
        acquisition.resolve(watcher);
        queueMicrotask(() => watcher.emit('event', { code, error: new Error('cancelled compilation') }));
        await vi.waitFor(() => expect(close).toHaveBeenCalledOnce());
        expect(closed).toBe(false);
        cleanup.resolve();
        await firstClose;
        await expect(handle.ready).resolves.toBeUndefined();
        await handle.close();
        expect(close).toHaveBeenCalledOnce();
    } finally {
        acquisition.resolve(watcher);
        cleanup.resolve();
        await handle.close();
    }
});

it('waits for a compilation started while close is awaiting the previous one', async () => {
    const close = vi.fn(async () => {});
    const watcher = Object.assign(new EventEmitter(), { close }) as unknown as EventEmitter & Rollup.RollupWatcher;

    vi.mocked(vite.build).mockResolvedValueOnce(watcher);

    const handle = buildWithWatchHook({ build: { watch: {} } }, () => {});
    const closing = handle.close();

    try {
        await vi.waitFor(() => expect(watcher.listenerCount('event')).toBe(1));
        watcher.emit('event', { code: 'BUNDLE_END' });
        watcher.emit('event', { code: 'BUNDLE_START' });
        await new Promise(setImmediate);
        expect(close).not.toHaveBeenCalled();
        watcher.emit('event', { code: 'BUNDLE_END' });
        await closing;
        expect(close).toHaveBeenCalledOnce();
    } finally {
        watcher.emit('event', { code: 'ERROR', error: new Error('cancelled compilation') });
        await closing;
    }
});

it.each([1, 2])('finishes asynchronous options in build %s before closing and stops real watching', async (gatedBuild) => {
    const {
        root,
        entry,
        config,
    } = await fixture('export const value = "initial";');
    const entered = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();
    const compiled = Promise.withResolvers<void>();
    const resource = createServer();
    let closed = 0;
    let builds = 0;
    let optionsCalls = 0;

    config.plugins = [{
        name: 'pending-watch-options',
        async options(options) {
            optionsCalls++;

            if (optionsCalls === gatedBuild) {
                entered.resolve();
                await release.promise;
            }

            return options;
        },
        async buildStart() {
            builds++;

            if (builds === gatedBuild) {
                await new Promise<void>((resolve, reject) => {
                    resource.once('error', reject);
                    resource.listen(0, '127.0.0.1', resolve);
                });
            }
        },
        buildEnd() {
            if (builds === gatedBuild) {
                compiled.resolve();
            }
        },
        async closeWatcher() {
            closed++;
            await new Promise<void>((resolve, reject) => {
                resource.close((error) => (error ? reject(error) : resolve()));
            });
        },
    }];

    const handle = buildWithWatchHook(config, () => {});

    try {
        if (gatedBuild === 2) {
            await handle.ready;
            await writeFile(entry, 'export const value = "rebuilt";');
        }

        await entered.promise;

        let settled = false;

        const closing = handle.close().then(() => {
            settled = true;
        });

        await new Promise(setImmediate);
        expect(settled).toBe(false);
        release.resolve();
        await closing;
        expect(closed).toBe(1);
        expect(resource.listening).toBe(false);
        await expect(handle.ready).resolves.toBeUndefined();

        const expectedOutput = gatedBuild === 1 ? 'initial' : 'rebuilt';

        expect(await readFile(join(root, 'dist/entry.mjs'), 'utf8')).toContain(expectedOutput);

        const buildsBeforeClose = builds;

        await writeFile(entry, 'export const value = "closed";');
        await new Promise((resolve) => {
            setTimeout(resolve, 150);
        });
        expect(builds).toBe(buildsBeforeClose);
        expect(await readFile(join(root, 'dist/entry.mjs'), 'utf8')).toContain(expectedOutput);
    } finally {
        release.resolve();
        await compiled.promise;
        await handle.close();

        if (resource.listening) {
            await new Promise<void>((resolve) => {
                resource.close(() => resolve());
            });
        }
    }
});

it('preserves the same cleanup failure for repeated close calls', async () => {
    const failure = new Error('watcher cleanup failed');
    const close = vi.fn(async () => {
        throw failure;
    });
    const watcher = Object.assign(new EventEmitter(), { close }) as unknown as EventEmitter & Rollup.RollupWatcher;

    vi.mocked(vite.build).mockResolvedValueOnce(watcher);

    const handle = buildWithWatchHook({ build: { watch: {} } }, () => {});

    try {
        const firstClose = handle.close();

        queueMicrotask(() => watcher.emit('event', { code: 'BUNDLE_END' }));
        await expect(firstClose).rejects.toBe(failure);
        expect(handle.close()).toBe(firstClose);
        await expect(handle.close()).rejects.toBe(failure);
        expect(close).toHaveBeenCalledOnce();
    } finally {
        await expect(handle.close()).rejects.toBe(failure);
    }
});

it('rejects readiness on the first compilation error', async () => {
    const { config } = await fixture('export const value = ;');
    const handle = buildWithWatchHook(config, () => {});

    try {
        await expect(handle.ready).rejects.toThrow();
    } finally {
        await handle.close();
    }
});

it('owns a non-watch build through completion', async () => {
    const { root, config } = await fixture('export const value = "built";');

    config.build!.watch = null;

    const reaction = vi.fn();
    const handle = buildWithWatchHook(config, reaction);

    try {
        await expect(handle.ready).resolves.toBeUndefined();
        expect(await readFile(join(root, 'dist/entry.mjs'), 'utf8')).toContain('built');
        await handle.close();
        expect(reaction).not.toHaveBeenCalled();
    } finally {
        await handle.close();
    }
});

it('awaits rebuild reactions, recovers after later compilation errors, and stops real watching', async () => {
    const {
        root,
        entry,
        config,
    } = await fixture('export const value = "initial";');
    const reactionGate = Promise.withResolvers<void>();
    let reactions = 0;
    let completedReactions = 0;
    let builds = 0;

    config.plugins = [{
        name: 'count-builds',
        buildStart() {
            builds++;
        },
    }];

    const handle = buildWithWatchHook(config, async () => {
        reactions++;

        if (reactions === 1) {
            await reactionGate.promise;
        }

        completedReactions++;
    });

    try {
        await expect(handle.ready).resolves.toBeUndefined();
        expect(reactions).toBe(0);
        expect(await readFile(join(root, 'dist/entry.mjs'), 'utf8')).toContain('initial');

        const watcher = [...watchers][0];
        const errors: Error[] = [];

        watcher.on('event', (event) => {
            if (event.code === 'ERROR') {
                errors.push(event.error);
            }
        });
        await writeFile(entry, 'export const value = "second";');
        await vi.waitFor(() => expect(reactions).toBe(1));
        await writeFile(entry, 'export const value = "third";');
        await new Promise((resolve) => {
            setTimeout(resolve, 100);
        });
        expect(builds).toBe(2);
        expect(completedReactions).toBe(0);
        reactionGate.resolve();
        await vi.waitFor(() => expect(completedReactions).toBe(2));

        await writeFile(entry, 'export const value = ;');
        await vi.waitFor(() => expect(errors).toHaveLength(1));
        expect(reactions).toBe(2);
        await expect(handle.ready).resolves.toBeUndefined();
        await writeFile(entry, 'export const value = "recovered";');
        await vi.waitFor(() => expect(completedReactions).toBe(3));
        expect(await readFile(join(root, 'dist/entry.mjs'), 'utf8')).toContain('recovered');

        await handle.close();

        const buildsBeforeClose = builds;

        await writeFile(entry, 'export const value = "closed";');
        await new Promise((resolve) => {
            setTimeout(resolve, 150);
        });
        expect(builds).toBe(buildsBeforeClose);
        expect(await readFile(join(root, 'dist/entry.mjs'), 'utf8')).toContain('recovered');
    } finally {
        reactionGate.resolve();
        await handle.close();
    }
});

it.each([false, true])('finishes asynchronous bundle finalization before initial readiness (failure=%s)', async (fail) => {
    const { config } = await fixture('export const value = "initial";');
    const entered = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();
    const failure = new Error('bundle finalization failed');
    const completed: string[] = [];
    let contextWatchMode: boolean | undefined;
    let readiness = 'pending';
    const plugin: Rollup.Plugin = {
        name: 'gated-bundle-finalizer',
        closeBundle: {
            order: 'pre',
            sequential: true,
            async handler() {
                contextWatchMode = this.meta.watchMode;
                entered.resolve();
                await release.promise;
                completed.push('first');

                if (fail) {
                    throw failure;
                }
            },
        },
    };
    const originalHook = plugin.closeBundle;

    config.plugins = [plugin, {
        name: 'last-bundle-finalizer',
        closeBundle: {
            order: 'post',
            sequential: true,
            handler() {
                completed.push('last');
            },
        },
    }];
    config.build!.rollupOptions = {
        plugins: [{
            name: 'replace-input-plugin-list',
            options: {
                order: 'post',
                handler(options) {
                    return { ...options, plugins: [Promise.resolve(options.plugins)] };
                },
            },
        }],
    };

    const handle = buildWithWatchHook(config, () => {});
    const observedReady = handle.ready.then(() => {
        readiness = 'resolved';
    }, () => {
        readiness = 'rejected';
    });

    try {
        await entered.promise;
        await new Promise(setImmediate);
        expect(readiness).toBe('pending');
        expect(completed).toEqual([]);
        release.resolve();

        if (fail) {
            await expect(handle.ready).rejects.toThrow('bundle finalization failed');
        } else {
            await expect(handle.ready).resolves.toBeUndefined();
        }

        expect(completed).toEqual(['first', 'last']);
        expect(contextWatchMode).toBe(true);
        expect(plugin.closeBundle).toBe(originalHook);
    } finally {
        release.resolve();
        await observedReady;
        await handle.close();
    }
});

it.each(['success', 'finalizer-failure', 'compilation-failure'])('waits for pending bundle finalization during close and retains its failure (result=%s)', async (result) => {
    const fail = result !== 'success';
    const { config } = await fixture(result === 'compilation-failure' ? 'export const value = ;' : 'export const value = "initial";');
    const entered = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();
    const failure = new Error('cancelled bundle finalization failed');
    let watcherClosed = false;

    config.plugins = [{
        name: 'cancelled-bundle-finalizer',
        async closeBundle() {
            entered.resolve();
            await release.promise;

            if (fail) {
                throw failure;
            }
        },
        closeWatcher() {
            watcherClosed = true;
        },
    }];

    const handle = buildWithWatchHook(config, () => {});
    let closing: Promise<void> | undefined;

    try {
        await entered.promise;

        let settled = false;

        closing = handle.close();
        void closing.then(() => {
            settled = true;
        }, () => {
            settled = true;
        });
        await new Promise(setImmediate);
        expect(settled).toBe(false);
        expect(watcherClosed).toBe(false);
        release.resolve();

        if (fail) {
            await expect(closing).rejects.toThrow('cancelled bundle finalization failed');
            expect(handle.close()).toBe(closing);
        } else {
            await expect(closing).resolves.toBeUndefined();
        }

        expect(watcherClosed).toBe(true);
    } finally {
        release.resolve();
        await (closing || handle.close()).catch(() => {});
    }
});

it('finishes rebuild finalization before reacting and recovers from a later finalizer failure', async () => {
    const { entry, config } = await fixture('export const value = "initial";');
    const entered = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();
    const failed = Promise.withResolvers<void>();
    let builds = 0;
    let reactions = 0;

    config.plugins = [{
        name: 'repeated-bundle-finalizer',
        buildStart() {
            builds++;
        },
        async closeBundle() {
            if (builds === 2) {
                entered.resolve();
                await release.promise;
            }

            if (builds !== 4) {
                return;
            }

            failed.resolve();

            throw new Error('later bundle finalization failed');
        },
    }];

    const handle = buildWithWatchHook(config, () => {
        reactions++;
    });

    try {
        await handle.ready;
        await writeFile(entry, 'export const value = "gated";');
        await entered.promise;
        await new Promise(setImmediate);
        expect(reactions).toBe(0);
        release.resolve();
        await vi.waitFor(() => expect(reactions).toBe(1));
        await writeFile(entry, 'export const value = "next";');
        await vi.waitFor(() => expect(reactions).toBe(2));

        const errors: Error[] = [];

        [...watchers][0].on('event', (event) => {
            if (event.code === 'ERROR') {
                errors.push(event.error);
            }
        });
        await writeFile(entry, 'export const value = "failed";');
        await failed.promise;
        await vi.waitFor(() => expect(errors).toHaveLength(1));
        expect(errors[0].message).toContain('later bundle finalization failed');
        expect(reactions).toBe(2);
        await writeFile(entry, 'export const value = "recovered";');
        await vi.waitFor(() => expect(reactions).toBe(3));
        await handle.close();
    } finally {
        release.resolve();
        await handle.close();
    }
});

it.each([false, true])('finalizes a bundle when writing fails before BUNDLE_END (finalizer failure=%s)', async (fail) => {
    const { config } = await fixture('export const value = "initial";');
    const writeFailure = new Error('bundle write failed');
    const finalizationFailure = new Error('failed write finalization failed');
    let finalized = false;

    config.plugins = [{
        name: 'failed-bundle-write',
        writeBundle() {
            throw writeFailure;
        },
        async closeBundle() {
            await new Promise(setImmediate);
            finalized = true;

            if (fail) {
                throw finalizationFailure;
            }
        },
    }];

    const handle = buildWithWatchHook(config, () => {});

    try {
        if (fail) {
            await expect(handle.ready).rejects.toMatchObject({ errors: [writeFailure, finalizationFailure] });
        } else {
            await expect(handle.ready).rejects.toBe(writeFailure);
        }

        expect(finalized).toBe(true);
    } finally {
        await handle.close();
    }
});

it('rejects invalid input options without waiting for unstarted bundle finalizers', async () => {
    const { config } = await fixture('export const value = "initial";');
    let finalized = false;

    config.build!.rollupOptions = JSON.parse('{"treeshake":{"preset":"invalid"}}');
    config.plugins = [{
        name: 'unstarted-bundle-finalizer',
        closeBundle() {
            finalized = true;
        },
    }];

    const handle = buildWithWatchHook(config, () => {});

    try {
        await expect(handle.ready).rejects.toThrow('treeshake.preset');
        expect(finalized).toBe(false);
    } finally {
        await handle.close();
    }
});

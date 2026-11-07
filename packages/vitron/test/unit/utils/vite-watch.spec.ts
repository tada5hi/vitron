import { EventEmitter } from 'node:events';
import {
    mkdtemp,
    readFile,
    rm,
    writeFile,
} from 'node:fs/promises';
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
            watch: {},
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

it('finishes asynchronous options before closing and stops real watching', async () => {
    const {
        root,
        entry,
        config,
    } = await fixture('export const value = "initial";');
    const entered = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();
    let closed = 0;
    let builds = 0;

    config.plugins = [{
        name: 'pending-watch-options',
        async options(options) {
            entered.resolve();
            await release.promise;

            return options;
        },
        buildStart() {
            builds++;
        },
        closeWatcher() {
            closed++;
        },
    }];

    const handle = buildWithWatchHook(config, () => {});

    try {
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
        await expect(handle.ready).resolves.toBeUndefined();
        expect(await readFile(join(root, 'dist/entry.mjs'), 'utf8')).toContain('initial');

        const buildsBeforeClose = builds;

        await writeFile(entry, 'export const value = "closed";');
        await new Promise((resolve) => {
            setTimeout(resolve, 150);
        });
        expect(builds).toBe(buildsBeforeClose);
        expect(await readFile(join(root, 'dist/entry.mjs'), 'utf8')).toContain('initial');
    } finally {
        release.resolve();
        await handle.close();
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

import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { InlineConfig } from 'vite';
import * as vite from 'vite';
import {
    afterEach,
    beforeEach,
    expect,
    it,
    vi,
} from 'vitest';
import { buildWithWatchHook } from '../../../src/core/vite/build';
import type { ViteWatchBuild } from '../../../src/core/vite/types';

vi.mock('vite', async (importOriginal: () => Promise<typeof vite>) => {
    const actual = await importOriginal();

    return { ...actual, build: vi.fn(actual.build) };
});

let dir: string;
let entry: string;

function createConfig(watch: boolean): InlineConfig {
    return {
        root: dir,
        configFile: false,
        logLevel: 'silent',
        build: {
            lib: {
                entry, 
                formats: ['es'], 
                fileName: 'out', 
            },
            outDir: path.join(dir, 'dist'),
            emptyOutDir: true,
            watch: watch ? {} : null,
        },
    };
}

async function waitFor(check: () => boolean) {
    const deadline = Date.now() + 10_000;

    while (!check()) {
        if (Date.now() > deadline) {
            throw new Error('timed out');
        }

        await new Promise((resolve) => {
            setTimeout(resolve, 20); 
        });
    }
}

// Rollup attaches its file watcher around the first BUNDLE_END and reports no readiness, so a write in that gap is lost.
async function writeUntil(content: string, check: () => boolean) {
    const deadline = Date.now() + 10_000;
    let nextWrite = 0;

    while (!check()) {
        if (Date.now() > deadline) {
            throw new Error('timed out');
        }

        if (Date.now() >= nextWrite) {
            await fs.writeFile(entry, content);
            nextWrite = Date.now() + 2000;
        }

        await new Promise((resolve) => {
            setTimeout(resolve, 20);
        });
    }
}

beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'vitron-watch-'));
    entry = path.join(dir, 'entry.js');
    await fs.writeFile(entry, 'export const value = 1;\n');
});

afterEach(async () => {
    vi.mocked(vite.build).mockClear();
    await fs.rm(dir, { recursive: true, force: true });
});

it('rejects ready on the first compilation error', async () => {
    await fs.writeFile(entry, 'export const = ;\n');

    const handle = buildWithWatchHook(createConfig(true), vi.fn());

    try {
        await expect(handle.ready).rejects.toThrow();
    } finally {
        await handle.close();
    }
});

it('resolves ready when a watch build returns no watcher', async () => {
    vi.mocked(vite.build).mockResolvedValueOnce({ output: [] } as never);

    const handle = buildWithWatchHook(createConfig(true), vi.fn());

    try {
        await expect(handle.ready).resolves.toBeUndefined();
    } finally {
        await handle.close();
    }
});

it('resolves ready for a non-watch build', async () => {
    const handle = buildWithWatchHook(createConfig(false), vi.fn());

    try {
        await expect(handle.ready).resolves.toBeUndefined();
    } finally {
        await handle.close();
    }
});

it('awaits the hook on rebuilds and recovers after a later error', async () => {
    let finished = 0;
    let started = 0;
    const hook = vi.fn(async () => {
        started++;
        await new Promise((resolve) => {
            setTimeout(resolve, 50); 
        });
        finished++;
    });
    const handle = buildWithWatchHook(createConfig(true), hook);

    try {
        await handle.ready;
        expect(hook).not.toHaveBeenCalled();

        await writeUntil('export const value = 2;\n', () => started === 1);
        expect(finished).toBe(0);
        await waitFor(() => finished === 1);

        await fs.writeFile(entry, 'export const = ;\n');
        await new Promise((resolve) => {
            setTimeout(resolve, 500); 
        });
        expect(hook).toHaveBeenCalledTimes(1);
        await expect(handle.ready).resolves.toBeUndefined();

        await fs.writeFile(entry, 'export const value = 3;\n');
        await waitFor(() => finished === 2);
        expect(hook).toHaveBeenCalledTimes(2);
    } finally {
        await handle.close();
    }
});

it('does not call the hook after close', async () => {
    const hook = vi.fn();
    const handle = buildWithWatchHook(createConfig(true), hook);

    try {
        await handle.ready;
    } finally {
        await handle.close();
    }

    await fs.writeFile(entry, 'export const value = 2;\n');
    await new Promise((resolve) => {
        setTimeout(resolve, 500); 
    });
    expect(hook).not.toHaveBeenCalled();
});

it('closes the eventual watcher once when closed during a delayed build', async () => {
    const watcher = { on: vi.fn(), close: vi.fn(async () => {}) };
    let release!: () => void;

    vi.mocked(vite.build).mockImplementationOnce(async () => {
        await new Promise<void>((resolve) => {
            release = resolve; 
        });

        return watcher as any;
    });

    const handle = buildWithWatchHook(createConfig(true), vi.fn());
    const closing = handle.close();

    await expect(handle.ready).resolves.toBeUndefined();
    expect(watcher.close).not.toHaveBeenCalled();

    release();
    await closing;
    expect(watcher.close).toHaveBeenCalledTimes(1);
});

it('shares one result between repeated close calls', async () => {
    const watcher = { on: vi.fn(), close: vi.fn(async () => {}) };

    vi.mocked(vite.build).mockImplementationOnce(async () => watcher as any);

    const handle: ViteWatchBuild = buildWithWatchHook(createConfig(true), vi.fn());
    const first = handle.close();
    const second = handle.close();

    await Promise.all([first, second]);
    expect(first).toBe(second);
    expect(watcher.close).toHaveBeenCalledTimes(1);
});

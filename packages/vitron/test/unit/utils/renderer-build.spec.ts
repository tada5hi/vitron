import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
    beforeEach, 
    describe, 
    expect, 
    it, 
    vi,
} from 'vitest';
import { buildRendererApp } from '../../../src/apps/renderer/build';
import { Framework } from '../../../src/utils';

const { sync, move } = vi.hoisted(() => ({ sync: vi.fn(), move: vi.fn() }));

vi.mock('cross-spawn', () => ({ default: { sync } }));
vi.mock('vite', () => ({ build: vi.fn() }));
vi.mock('../../../src/apps/renderer/move', () => ({ moveAppRendererDirectory: move }));
vi.mock('../../../src/apps/renderer/config', () => ({ buildRendererConfig: vi.fn() }));

const rootPath = '/project';

function createConfig(values: Record<string, any>) {
    const all = {
        rootPath, 
        rendererDirectory: 'renderer', 
        ...values, 
    };

    return { get: (key?: string) => (key ? (all as any)[key] : all) } as any;
}

const custom = () => createConfig({ rendererBuildCommand: () => 'custom tool --flag' });

beforeEach(() => {
    sync.mockReset();
    move.mockReset();
});

describe('renderer build', () => {
    it('runs a custom command through a shell from the project root', async () => {
        sync.mockReturnValueOnce({ status: 0 });

        await buildRendererApp(custom());

        expect(sync).toHaveBeenCalledTimes(1);
        expect(sync).toHaveBeenCalledWith('custom tool --flag', {
            shell: true, 
            cwd: rootPath, 
            stdio: 'inherit', 
        });
        expect(move).toHaveBeenCalledTimes(1);
    });

    it('rejects a custom launch error before moving output', async () => {
        const error = new Error('spawn failed');

        sync.mockReturnValueOnce({ error, status: null });

        await expect(buildRendererApp(custom())).rejects.toBe(error);
        expect(move).not.toHaveBeenCalled();
    });

    it('rejects a custom command exit status', async () => {
        sync.mockReturnValueOnce({ status: 1 });

        await expect(buildRendererApp(custom())).rejects.toThrow('custom tool --flag exited with status 1.');
        expect(move).not.toHaveBeenCalled();
    });

    it('names the signal when a command is terminated', async () => {
        sync.mockReturnValueOnce({ status: null, signal: 'SIGTERM' });

        await expect(buildRendererApp(custom()))
            .rejects.toThrow('custom tool --flag exited with status null (SIGTERM).');
    });

    describe.each([
        ['2.17.0', 'nuxt'],
        ['3.0.0', 'nuxi'],
    ])('nuxt %s', (version, bin) => {
        const nuxt = () => createConfig({ framework: { name: Framework.NUXT, version } });

        it('stops the Nuxt sequence after the first failure', async () => {
            sync.mockReturnValueOnce({ status: 1 });

            await expect(buildRendererApp(nuxt())).rejects.toThrow(`${bin} build exited with status 1.`);
            expect(sync).toHaveBeenCalledTimes(1);
            expect(move).not.toHaveBeenCalled();
        });

        it('moves Nuxt output after both commands succeed', async () => {
            sync.mockReturnValue({ status: 0 });

            await buildRendererApp(nuxt());

            const options = {
                cwd: rootPath, 
                stdio: 'inherit', 
                detached: false, 
            };

            expect(sync.mock.calls).toEqual([
                [bin, ['build', 'renderer'], options],
                [bin, ['generate', 'renderer'], options],
            ]);
            expect(move).toHaveBeenCalledTimes(1);
        });
    });
});

describe('renderer build without mocks', () => {
    it('reports failure in a compound shell command', async () => {
        const actual = await vi.importActual<{ default: { sync: (...args: any[]) => any } }>('cross-spawn');

        sync.mockImplementation((...args: any[]) => actual.default.sync(...args));

        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vitron-renderer-'));

        try {
            await expect(buildRendererApp(createConfig({
                rootPath: root,
                rendererBuildCommand: () => 'true && false',
            }))).rejects.toThrow('true && false exited with status 1.');
        } finally {
            fs.rmSync(root, { recursive: true, force: true });
        }
    });
});

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
import type * as rendererMove from '../../../src/apps/renderer/move';
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

describe('next build', () => {
    const next = (values: Record<string, any> = {}) => createConfig({
        framework: { name: Framework.NEXT, version: '14.0.0' },
        ...values,
    });

    function withOutput(callback: (root: string) => Promise<void>, emit = true) {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vitron-next-build-'));

        sync.mockImplementation(() => {
            if (emit) {
                fs.mkdirSync(path.join(root, 'renderer/dist'), { recursive: true });
                fs.writeFileSync(path.join(root, 'renderer/dist/index.html'), '');
            }

            return { status: 0 };
        });

        return callback(root).finally(() => fs.rmSync(root, { recursive: true, force: true }));
    }

    it('runs only next build', () => withOutput(async (root) => {
        await buildRendererApp(next({ rootPath: root, rendererBuildDirectory: 'dist' }));

        expect(sync.mock.calls).toEqual([['next', ['build', 'renderer'], {
            cwd: root,
            stdio: 'inherit',
            detached: false,
        }]]);
        expect(move).toHaveBeenCalledTimes(1);
    }));

    it('fails when the Next output has no index.html', () => withOutput(async (root) => {
        const run = buildRendererApp(next({ rootPath: root, rendererBuildDirectory: 'dist' }));

        await expect(run).rejects.toThrow("output: 'export'");
        await expect(run).rejects.toThrow('distDir');
        expect(move).not.toHaveBeenCalled();
    }, false));

    it('does not accept a stale index.html from an earlier build', () => withOutput(async (root) => {
        fs.mkdirSync(path.join(root, 'renderer/dist'), { recursive: true });
        fs.writeFileSync(path.join(root, 'renderer/dist/index.html'), 'stale');

        const run = buildRendererApp(next({ rootPath: root, rendererBuildDirectory: 'dist' }));

        await expect(run).rejects.toThrow("output: 'export'");
        await expect(run).rejects.toThrow('distDir');
        expect(move).not.toHaveBeenCalled();
    }, false));

    it.each([
        ['.', () => '.', 'renderer/page.tsx'],
        ['an empty string', () => '', 'renderer/page.tsx'],
        ['..', () => '..', 'keep.txt'],
        ['an absolute path outside the renderer', (root: string) => path.join(root, 'outside'), 'outside/keep.txt'],
    ])('keeps files on disk when rendererBuildDirectory is %s', (_label, directory, kept) => withOutput(async (root) => {
        const keptPath = path.join(root, kept);

        fs.mkdirSync(path.join(root, 'renderer'), { recursive: true });
        fs.mkdirSync(path.dirname(keptPath), { recursive: true });
        fs.writeFileSync(path.join(root, 'renderer/page.tsx'), 'source');
        fs.writeFileSync(keptPath, 'keep');

        await expect(buildRendererApp(next({ rootPath: root, rendererBuildDirectory: directory(root) })))
            .rejects.toThrow('distDir');
        expect(fs.existsSync(keptPath)).toBe(true);
        expect(fs.existsSync(path.join(root, 'renderer/page.tsx'))).toBe(true);
        expect(sync).toHaveBeenCalledTimes(1);
    }, false));

    it('does not follow a symlink out of the renderer when clearing output', () => withOutput(async (root) => {
        const external = path.join(root, 'external');

        fs.mkdirSync(path.join(external, 'dist'), { recursive: true });
        fs.writeFileSync(path.join(external, 'dist/index.html'), 'stale');
        fs.mkdirSync(path.join(root, 'renderer'), { recursive: true });
        fs.symlinkSync(external, path.join(root, 'renderer/generated'), 'dir');

        await expect(buildRendererApp(next({ rootPath: root, rendererBuildDirectory: 'generated/dist' })))
            .rejects.toThrow('distDir');
        expect(fs.readFileSync(path.join(external, 'dist/index.html'), 'utf8')).toBe('stale');
    }, false));

    it('keeps a source directory that holds no earlier export', () => withOutput(async (root) => {
        fs.mkdirSync(path.join(root, 'renderer/app'), { recursive: true });
        fs.writeFileSync(path.join(root, 'renderer/app/page.tsx'), 'source');

        await expect(buildRendererApp(next({ rootPath: root, rendererBuildDirectory: 'app' })))
            .rejects.toThrow('distDir');
        expect(fs.existsSync(path.join(root, 'renderer/app/page.tsx'))).toBe(true);
    }, false));

    it('rejects an index.html outside the renderer that the build did not rewrite', () => withOutput(async (root) => {
        fs.mkdirSync(path.join(root, 'renderer'), { recursive: true });
        fs.mkdirSync(path.join(root, 'export'), { recursive: true });
        fs.writeFileSync(path.join(root, 'export/index.html'), 'stale');

        await expect(buildRendererApp(next({ rootPath: root, rendererBuildDirectory: '../export' })))
            .rejects.toThrow('distDir');
        expect(fs.readFileSync(path.join(root, 'export/index.html'), 'utf8')).toBe('stale');
        expect(move).not.toHaveBeenCalled();
    }, false));

    it('accepts an index.html outside the renderer that the build rewrote', () => withOutput(async (root) => {
        const indexPath = path.join(root, 'export/index.html');

        fs.mkdirSync(path.join(root, 'renderer'), { recursive: true });
        fs.mkdirSync(path.dirname(indexPath), { recursive: true });
        fs.writeFileSync(indexPath, 'previous');
        fs.utimesSync(indexPath, new Date(1000), new Date(1000));
        sync.mockImplementation(() => {
            fs.writeFileSync(indexPath, 'current');

            return { status: 0 };
        });

        await buildRendererApp(next({ rootPath: root, rendererBuildDirectory: '../export' }));

        expect(move).toHaveBeenCalledTimes(1);
    }));

    it('rejects an unsupported Next before spawning', async () => {
        await expect(buildRendererApp(next({ framework: { name: Framework.NEXT, version: '13.5.0' } })))
            .rejects.toThrow('Next.js 14');
        expect(sync).not.toHaveBeenCalled();
    });

    it('custom build commands skip the Next version check', async () => {
        sync.mockReturnValueOnce({ status: 0 });

        await buildRendererApp(createConfig({
            framework: { name: Framework.NEXT, version: '13.5.0' },
            rendererBuildCommand: () => 'custom tool',
        }));

        expect(sync).toHaveBeenCalledTimes(1);
        expect(move).toHaveBeenCalledTimes(1);
    });
});

describe('renderer output move', () => {
    it('copies an absolute rendererBuildDirectory', async () => {
        const { moveAppRendererDirectory } = await vi.importActual<typeof rendererMove>('../../../src/apps/renderer/move');
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vitron-renderer-move-'));

        try {
            fs.mkdirSync(path.join(root, 'out'), { recursive: true });
            fs.writeFileSync(path.join(root, 'out/index.html'), 'export');

            await moveAppRendererDirectory(createConfig({
                rootPath: root,
                buildDirectory: '.vitron',
                rendererBuildDirectory: path.join(root, 'out'),
            }));

            expect(fs.readFileSync(path.join(root, '.vitron/renderer/index.html'), 'utf8')).toBe('export');
        } finally {
            fs.rmSync(root, { recursive: true, force: true });
        }
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

import { access, readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { expect, it, vi } from 'vitest';

vi.mock('electron', () => ({ app: {}, contextBridge: {} }));

const root = fileURLToPath(new URL('../../../', import.meta.url));
const manifest = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));

it.each(['.', './main', './preload', './renderer'])('publishes usable ESM and declaration targets for %s', async (subpath) => {
    const target = manifest.exports[subpath];

    expect(target.require).toBeUndefined();

    const js = typeof target.import === 'string' ? target.import : target.import.default;
    const types = target.types || target.import.types;

    expect(js).toMatch(/\.mjs$/);
    expect(types).toMatch(/\.d\.mts$/);
    await access(path.join(root, js));
    await access(path.join(root, types));
    expect(await readdir(path.dirname(path.join(root, js)))).not.toEqual(expect.arrayContaining([expect.stringMatching(/\.(cjs|cts)$/)]));

    if (subpath === '.') {
        return;
    }

    const metadata = JSON.parse(await readFile(path.join(root, subpath, 'package.json'), 'utf8'));

    await access(path.join(root, subpath, metadata.main));
    await access(path.join(root, subpath, metadata.types));

    const exports = await ({
        './main': () => import('vitron/main'),
        './preload': () => import('vitron/preload'),
        './renderer': () => import('vitron/renderer'),
    }[subpath]!());
    const name = {
        './main': 'serve',
        './preload': 'provide',
        './renderer': 'inject',
    }[subpath];

    expect(typeof exports[name!]).toBe('function');
});

it('runs the package root through its ESM export', async () => {
    const { spawnSync } = await import('node:child_process');
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', "process.argv = ['node', 'vitron', '--help']; await import('vitron');"], {
        cwd: root,
        encoding: 'utf8',
        timeout: 10_000,
    });

    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain('Usage: vitron');
});

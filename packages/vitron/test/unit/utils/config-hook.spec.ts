import {
    mkdir,
    mkdtemp,
    rm,
    writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { InlineConfig } from 'vite';
import { expect, it } from 'vitest';
import { buildRendererConfig } from '../../../src/apps/renderer/config';
import { applyConfigHook } from '../../../src/apps/utils/config-hook';
import { buildConfig } from '../../../src/config';
import { EnvironmentName } from '../../../src/constants';

it('merges a returned object with custom values winning', () => {
    const input: InlineConfig = {
        mode: 'production', 
        root: '/base', 
        build: { outDir: 'base' }, 
    };
    const result = applyConfigHook(input, () => ({ root: '/custom', define: { A: '1' } }));

    expect(result.root).toBe('/custom');
    expect(result.mode).toBe('production');
    expect(result.build!.outDir).toBe('base');
    expect(result.define).toEqual({ A: '1' });
});

it('does not duplicate arrays when the hook returns its input', () => {
    const input: InlineConfig = { plugins: [{ name: 'a' }] };
    const result = applyConfigHook(input, (config) => config);

    expect(result.plugins).toHaveLength(1);
});

it('does not duplicate arrays the returned object shares with the input', () => {
    const plugin = { name: 'a' };
    const input: InlineConfig = { plugins: [plugin], build: { rollupOptions: { external: ['x'] } } };
    const result = applyConfigHook(input, (config) => ({
        ...config,
        root: '/custom',
        build: { ...config.build },
    }));

    expect(result.plugins).toEqual([plugin]);
    expect(result.build!.rollupOptions!.external).toEqual(['x']);
    expect(result.root).toBe('/custom');
});

it('still concatenates distinct arrays', () => {
    const input: InlineConfig = { plugins: [{ name: 'base' }] };
    const result = applyConfigHook(input, () => ({ plugins: [{ name: 'custom' }] }));

    expect(result.plugins).toEqual([{ name: 'custom' }, { name: 'base' }]);
});

it('keeps mutations when the hook returns nothing', () => {
    const input: InlineConfig = { mode: 'production' };
    const result = applyConfigHook(input, (config) => {
        config.root = '/mutated';
    });

    expect(result.root).toBe('/mutated');
    expect(result.mode).toBe('production');
});

it('uses the rendererConfig return value', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'vitron-config-hook-'));

    try {
        await writeFile(path.join(root, 'package.json'), '{}');
        await mkdir(path.join(root, 'src', 'renderer'), { recursive: true });

        const config = buildConfig({
            rootPath: root,
            rendererConfig: () => ({ define: { MARKER: '"returned"' } }),
        });
        const result = await buildRendererConfig(config, EnvironmentName.PRODUCTION);

        expect(result.define).toEqual({ MARKER: '"returned"' });
        expect(result.mode).toBe('production');
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});

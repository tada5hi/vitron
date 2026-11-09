import {
    mkdir,
    mkdtemp,
    rm,
    writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { 
    afterEach, 
    describe, 
    expect, 
    it, 
} from 'vitest';
import { AppName } from '../../../src/apps/constants';
import { buildElectronConfig } from '../../../src/apps/utils/electron-config';
import { buildConfig } from '../../../src/config';
import type { OptionsInput } from '../../../src/config';

const roots: string[] = [];

async function createProject(options: {
    manifest?: string,
    apps?: string[],
} = {}) {
    const root = await mkdtemp(path.join(tmpdir(), 'vitron-electron-config-'));

    roots.push(root);

    await writeFile(path.join(root, 'package.json'), options.manifest ?? JSON.stringify({
        dependencies: { 'dep-a': '1.0.0' },
        peerDependencies: { 'peer-a': '1.0.0' },
    }));

    for (const app of options.apps ?? ['main', 'preload']) {
        await mkdir(path.join(root, 'src', app), { recursive: true });
        await writeFile(path.join(root, 'src', app, 'index.ts'), 'export {};');
    }

    return root;
}

function createConfig(rootPath: string, input: Partial<OptionsInput> = {}) {
    return buildConfig({ rootPath, ...input });
}

afterEach(async () => {
    await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe.each([AppName.MAIN, AppName.PRELOAD] as const)('buildElectronConfig for %s', (app) => {
    it('returns the shared build policy', async () => {
        const root = await createProject();
        const config = createConfig(root);
        const result = await buildElectronConfig(config, app);
        const entry = path.join(root, 'src', app, 'index.ts');

        expect(result).toBeDefined();
        expect(result!.mode).toBe(config.get('env'));
        expect(result!.root).toBe(path.resolve(root, 'src', app));
        expect(result!.optimizeDeps).toEqual({ esbuildOptions: { target: 'es2020' } });
        expect(result!.build).toMatchObject({
            watch: {},
            manifest: true,
            target: 'es2020',
            outDir: path.join(root, '.vitron', app),
            lib: {
                entry, 
                fileName: 'index', 
                formats: ['cjs'], 
            },
        });
        expect(result!.build!.rollupOptions!.input).toBe(entry);
    });

    it('externalizes dependencies, peers, electron and node built-ins', async () => {
        const root = await createProject();
        const result = await buildElectronConfig(createConfig(root), app);
        const external = result!.build!.rollupOptions!.external as string[];

        expect(external).toEqual(expect.arrayContaining([
            'dep-a',
            'peer-a',
            'electron',
            'fs/promises',
            'node:fs/promises',
        ]));
    });

    it('builds when the manifest has no dependency maps', async () => {
        const root = await createProject({ manifest: '{}' });
        const result = await buildElectronConfig(createConfig(root), app);

        expect(result!.build!.rollupOptions!.external).toContain('electron');
    });

    it('returns undefined when the entry is missing', async () => {
        const root = await createProject({ apps: [] });

        expect(await buildElectronConfig(createConfig(root), app)).toBeUndefined();
    });

    it('rejects an invalid manifest even when the entry is missing', async () => {
        const root = await createProject({ apps: [] });
        const config = createConfig(root);

        await writeFile(path.join(root, 'package.json'), '{ not json');
        await expect(buildElectronConfig(config, app)).rejects.toThrow();
    });

    it('returns fresh objects on every call', async () => {
        const root = await createProject();
        const config = createConfig(root);
        const first = await buildElectronConfig(config, app);
        const second = await buildElectronConfig(config, app);

        expect(first!.build).not.toBe(second!.build);
        expect(first!.build!.rollupOptions!.external).not.toBe(second!.build!.rollupOptions!.external);
    });
});

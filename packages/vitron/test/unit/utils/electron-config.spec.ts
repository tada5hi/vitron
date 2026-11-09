import { execFileSync } from 'node:child_process';
import {
    mkdir,
    mkdtemp,
    readFile,
    rm,
    writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { build } from 'vite';
import {
    afterEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';
import { AppName } from '../../../src/apps/constants';
import { buildMainConfig } from '../../../src/apps/main/config';
import { buildPreloadConfig } from '../../../src/apps/preload/config';
import { buildElectronConfig } from '../../../src/apps/utils/electron-config';
import { buildConfig } from '../../../src/config';
import type { InlineConfig } from 'vite';
import type { OptionsInput } from '../../../src/config';

vi.mock('@rollup/plugin-replace', () => ({ default: vi.fn((options: unknown) => ({ name: 'replace-mock', options })) }));

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
        expect(result!.optimizeDeps).toEqual({ rolldownOptions: { transform: { target: 'es2020' } } });
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
        expect(result!.build!.rolldownOptions!.input).toBe(entry);
    });

    it('externalizes dependencies, peers, electron and node built-ins', async () => {
        const root = await createProject();
        const result = await buildElectronConfig(createConfig(root), app);
        const external = result!.build!.rolldownOptions!.external as string[];

        expect(external).toEqual(expect.arrayContaining([
            'dep-a',
            'peer-a',
            'electron',
            'fs/promises',
            'node:fs/promises',
        ]));
    });

    it('emits strict CommonJS named index with externals left as requires', async () => {
        const root = await createProject();

        await writeFile(path.join(root, 'src', app, 'index.ts'), [
            "import dep from 'dep-a';",
            "import peer from 'peer-a';",
            "import { app as electron } from 'electron';",
            "import { readFileSync } from 'fs';",
            "import { join } from 'node:path';",
            'console.log(dep, peer, electron, readFileSync, join);',
        ].join('\n'));

        const config = await buildElectronConfig(createConfig(root), app);

        await build({
            ...config,
            configFile: false,
            logLevel: 'silent',
            build: { ...config!.build, watch: null },
        });

        const output = await readFile(path.join(root, '.vitron', app, 'index.js'), 'utf8');

        expect(output.startsWith('"use strict";')).toBe(true);
        expect(output).not.toMatch(/^\s*(import|export)\s/m);

        for (const name of ['dep-a', 'peer-a', 'electron', 'fs', 'node:path']) {
            expect(output).toContain(`require("${name}")`);
        }
    });

    it('gives built code a working import.meta.url', async () => {
        const root = await createProject();

        await writeFile(
            path.join(root, 'src', app, 'index.ts'),
            "console.log(JSON.stringify({ url: import.meta.url, sibling: new URL('./x', import.meta.url).href }));",
        );

        const config = await buildElectronConfig(createConfig(root), app);

        await build({
            ...config,
            configFile: false,
            logLevel: 'silent',
            build: { ...config!.build, watch: null },
        });

        const stdout = execFileSync(process.execPath, [path.join(root, '.vitron', app, 'index.js')], { encoding: 'utf8' });
        const { url, sibling } = JSON.parse(stdout);

        expect(url).toMatch(new RegExp(`^file://.*/\\.vitron/${app}/index\\.js$`));
        expect(sibling).toMatch(new RegExp(`^file://.*/\\.vitron/${app}/x$`));
    });

    it('builds when the manifest has no dependency maps', async () => {
        const root = await createProject({ manifest: '{}' });
        const result = await buildElectronConfig(createConfig(root), app);

        expect(result!.build!.rolldownOptions!.external).toContain('electron');
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
        expect(first!.build!.rolldownOptions!.external).not.toBe(second!.build!.rolldownOptions!.external);
    });
});

const wrappers = [
    {
        app: AppName.MAIN,
        build: buildMainConfig,
        hookKey: 'mainConfig',
        emptyOutDir: false,
    },
    {
        app: AppName.PRELOAD,
        build: buildPreloadConfig,
        hookKey: 'preloadConfig',
        emptyOutDir: true,
    },
] as const;

describe.each(wrappers)('build $app config', ({
    app,
    build,
    hookKey,
    emptyOutDir,
}) => {
    function createHooked(root: string, hook: (input: InlineConfig) => InlineConfig | void) {
        return createConfig(root, { [hookKey]: hook } as Partial<OptionsInput>);
    }

    it('passes the defaults to the hook and lets returned values win', async () => {
        const root = await createProject();
        let received: InlineConfig | undefined;
        const result = await build(createHooked(root, (input) => {
            received = input;

            return { build: { target: 'es2022' } };
        }));

        expect(received!.build!.emptyOutDir).toBe(emptyOutDir);
        expect(result!.build!.target).toBe('es2022');
        expect(result!.build!.manifest).toBe(true);
        expect(result!.build!.emptyOutDir).toBe(emptyOutDir);
    });

    it('does not duplicate plugins when a hook returns its input', async () => {
        const root = await createProject();
        const baseline = await build(createConfig(root));
        const result = await build(createHooked(root, (input) => {
            input.plugins = [{ name: 'custom' }];

            return input;
        }));

        expect(result!.plugins).toHaveLength(1);
        expect(result!.build!.rolldownOptions!.plugins).toEqual(baseline!.build!.rolldownOptions!.plugins);
        expect(result!.build!.rolldownOptions!.external).toEqual(baseline!.build!.rolldownOptions!.external);
    });

    it('does not wipe the config when a hook returns nothing', async () => {
        const root = await createProject();
        const baseline = await build(createConfig(root));
        const result = await build(createHooked(root, (input) => {
            input.plugins = [{ name: 'custom' }];
        }));

        expect(result!.plugins).toHaveLength(1);
        expect(result!.build!.manifest).toBe(true);
        expect(result!.build!.rolldownOptions!.plugins).toEqual(baseline!.build!.rolldownOptions!.plugins);
    });

    it('does not leak hook mutations into the next build', async () => {
        const root = await createProject();
        const config = createHooked(root, (input) => {
            (input.build!.rolldownOptions!.external as string[]).push('leaked');

            return input;
        });

        await build(config);

        const next = await buildElectronConfig(config, app);

        expect(next!.build!.rolldownOptions!.external).not.toContain('leaked');
    });
});

describe('buildMainConfig', () => {
    it('throws when the main entry is missing', async () => {
        const root = await createProject({ apps: ['preload'] });

        await expect(buildMainConfig(createConfig(root)))
            .rejects.toThrow('The main entrypoint file could not be located...');
    });

    it('adds main-only settings', async () => {
        const root = await createProject();
        const config = createConfig(root, { port: 1234 });
        const result = await buildMainConfig(config);

        expect(result.build!.emptyOutDir).toBe(false);
        expect(result.server).toEqual({});
        expect(result.define).toEqual({
            NODE_ENV: `"${config.get('env')}"`,
            PORT: '"1234"',
        });
        expect(result.build!.rolldownOptions!.plugins).toEqual([
            {
                name: 'replace-mock',
                options: {
                    preventAssignment: true,
                    uncrypto: 'crypto',
                    'process.env.NODE_ENV': `"${config.get('env')}"`,
                    'process.env.PORT': '"1234"',
                },
            },
        ]);
    });
});

describe('buildPreloadConfig', () => {
    it('is optional when the preload entry is missing', async () => {
        const root = await createProject({ apps: ['main'] });

        expect(await buildPreloadConfig(createConfig(root))).toBeUndefined();
    });

    it('rejects an invalid manifest even without a preload entry', async () => {
        const root = await createProject({ apps: ['main'] });
        const config = createConfig(root);

        await writeFile(path.join(root, 'package.json'), '{ not json');

        await expect(buildPreloadConfig(config)).rejects.toThrow();
    });

    it('has no main-only settings', async () => {
        const root = await createProject();
        const result = await buildPreloadConfig(createConfig(root));

        expect(result!.server).toBeUndefined();
        expect(result!.define).toBeUndefined();
        expect(result!.build!.rolldownOptions!.plugins).toBeUndefined();
    });
});

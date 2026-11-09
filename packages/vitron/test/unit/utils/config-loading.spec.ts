import {
    mkdir,
    mkdtemp,
    readFile,
    rm,
    writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { expect, it } from 'vitest';
import { buildConfig, loadOptions } from '../../../src/config';
import { buildMainConfig } from '../../../src/apps/main/config';
import { buildPreloadConfig } from '../../../src/apps/preload/config';
import { buildRendererConfig } from '../../../src/apps/renderer/config';
import { EnvironmentName } from '../../../src/constants';

it.each(['json', 'cjs', 'mjs', 'js', 'ts', 'cts', 'mts'])('discovers and loads a %s configuration from the requested directory', async (extension) => {
    const root = await mkdtemp(path.join(tmpdir(), 'vitron-config-'));

    try {
        const body = extension === 'json' ?
            '{"port":9123,"mainDirectory":"custom/main"}' :
            `${extension === 'cjs' || extension === 'cts' ? 'module.exports =' : 'export default'} { port: 9123, mainDirectory: 'custom/main', mainConfig: () => ({ marker: 'loaded' }) };`;

        await writeFile(path.join(root, 'package.json'), '{"type":"module"}');
        await writeFile(path.join(root, `vitron.config.${extension}`), body);

        const options = await loadOptions(root);

        expect(options.port).toBe(9123);
        expect(options.mainDirectory).toBe('custom/main');

        if (extension !== 'json') {
            expect(options.mainConfig!({})).toEqual({ marker: 'loaded' });
        }
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});

it('reads project dependencies for all process configurations', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'vitron-config-apps-'));

    try {
        await writeFile(path.join(root, 'package.json'), JSON.stringify({ dependencies: { example: '^1' }, peerDependencies: { peer: '^2' } }));

        for (const name of ['main', 'preload']) {
            await mkdir(path.join(root, 'src', name), { recursive: true });
            await writeFile(path.join(root, 'src', name, 'index.ts'), 'export {};');
        }

        const config = buildConfig({ rootPath: root });
        const configs = await Promise.all([
            buildMainConfig(config),
            buildPreloadConfig(config),
            buildRendererConfig(config, EnvironmentName.PRODUCTION),
        ]);

        for (const appConfig of configs) {
            expect(appConfig!.build!.rolldownOptions!.external).toEqual(expect.arrayContaining(['example', 'peer']));
        }
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});

it('resolves an explicitly selected installed framework package', async () => {
    const manifest = JSON.parse(await readFile(createRequire(import.meta.url).resolve('nuxt/package.json'), 'utf8'));
    const config = buildConfig({ framework: 'nuxt' });

    expect(config.get('framework')).toEqual({ name: 'nuxt', version: manifest.version });
});

it.each([true, false])('resolves the project framework with its manifest export set to %s', async (exportManifest) => {
    const root = await mkdtemp(path.join(tmpdir(), 'vitron-project-framework-'));
    const installed = path.join(root, 'node_modules', 'nuxt');

    try {
        await mkdir(installed, { recursive: true });
        await writeFile(path.join(installed, 'index.mjs'), 'export {};');
        await writeFile(path.join(installed, 'package.json'), JSON.stringify({
            name: 'nuxt',
            version: '3.12.34',
            exports: {
                '.': { import: './index.mjs' },
                ...(exportManifest ? { './package.json': './package.json' } : {}),
            },
        }));

        // Put framework first so resolution cannot depend on option insertion order.
        const config = buildConfig({ framework: 'nuxt', rootPath: root });

        expect(config.get('framework')).toEqual({ name: 'nuxt', version: '3.12.34' });
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});

it('merges every discovered configuration file', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'vitron-config-merge-'));

    try {
        await writeFile(path.join(root, 'vitron.config.json'), '{"port":9123}');
        await writeFile(path.join(root, 'vitron.config.cjs'), "module.exports = { mainDirectory: 'custom/main' };");

        expect(await loadOptions(root)).toEqual({ port: 9123, mainDirectory: 'custom/main' });
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});

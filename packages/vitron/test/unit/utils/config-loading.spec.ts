import {
    mkdir,
    mkdtemp,
    rm,
    writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
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
            expect(appConfig!.build!.rollupOptions!.external).toEqual(expect.arrayContaining(['example', 'peer']));
        }
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});

it('resolves an explicitly selected installed framework package', () => {
    const config = buildConfig({ framework: 'nuxt' });

    expect(config.get('framework')).toEqual({ name: 'nuxt', version: expect.stringMatching(/^\d+\./) });
});

import { 
    mkdir, 
    mkdtemp, 
    readFile, 
    rm, 
    writeFile, 
} from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { expect, it } from 'vitest';

it.each(['vanilla', 'nuxt'])('packages the installed hoisted Electron version for %s', async (example) => {
    const directory = await mkdtemp(path.join(tmpdir(), 'vitron-electron-version-'));
    const project = path.join(directory, 'examples', example);
    const electron = path.join(directory, 'node_modules', 'electron');

    try {
        await mkdir(project, { recursive: true });
        await mkdir(electron, { recursive: true });
        await writeFile(path.join(electron, 'package.json'), JSON.stringify({ name: 'electron', version: '38.9.4' }));

        const configSource = await readFile(new URL(`../../../../../examples/${example}/electron-builder.mjs`, import.meta.url), 'utf8');

        await writeFile(path.join(project, 'electron-builder.mjs'), configSource);

        const require = createRequire(path.join(project, 'package.json'));
        const config = require('./electron-builder.mjs').default;

        expect(config.electronVersion).toBe('38.9.4');
        expect(config.extends).toBe('./electron-builder.yml');
    } finally {
        await rm(directory, { recursive: true, force: true });
    }
});

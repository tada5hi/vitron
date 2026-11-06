import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { expect, it } from 'vitest';
import { loadOptions } from '../../../src/config/utils/find';

it.each([
    ['json', JSON.stringify({ port: 9123 })],
    ['cjs', 'module.exports = { port: 9123 };'],
    ['mjs', 'export default { port: 9123 };'],
    ['ts', 'export default { port: 9123 as number };'],
])('loads a %s configuration from the supplied directory', async (extension, source) => {
    const directory = await mkdtemp(path.join(tmpdir(), 'vitron-config-'));

    try {
        await writeFile(path.join(directory, `vitron.config.${extension}`), source);

        expect(await loadOptions(directory)).toEqual({ port: 9123 });
    } finally {
        await rm(directory, { recursive: true, force: true });
    }
});

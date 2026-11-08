import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';

const packageRoot = fileURLToPath(new URL('../../../', import.meta.url));
const manifest = JSON.parse(await readFile(path.join(packageRoot, 'package.json'), 'utf8'));
const cliPath = path.join(packageRoot, manifest.bin.vitron);

it('starts the built command line entry point', () => {
    const result = spawnSync(process.execPath, [cliPath, '--help'], {
        encoding: 'utf8',
        timeout: 10_000,
    });

    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain('Usage: vitron <command> [options]');
});

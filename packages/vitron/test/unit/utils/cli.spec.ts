import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';

it('starts the built command line entry point', () => {
    const result = spawnSync(process.execPath, [fileURLToPath(new URL('../../../dist/index.cjs', import.meta.url)), '--help'], {
        encoding: 'utf8',
        timeout: 10_000,
    });

    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain('Usage: vitron <command> [options]');
});

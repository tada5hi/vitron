import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import {
    mkdir,
    mkdtemp,
    readFile,
    rm,
    writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripVTControlCharacters } from 'node:util';
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

it('prints a development failure once, without the usage text', { timeout: 15_000 }, async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'vitron-missing-main-'));

    try {
        await writeFile(path.join(root, 'package.json'), '{"name":"missing-main"}');

        const result = spawnSync(process.execPath, [cliPath, 'dev', '--root', root], {
            cwd: root,
            encoding: 'utf8',
            timeout: 10_000,
        });
        const output = result.stderr;

        expect(result.status).toBe(1);
        expect(output.split('The main entrypoint file could not be located').length - 1).toBe(1);
        expect(output).not.toContain('Options:');
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});

it('writes a whole development failure to a slow pipe before exiting', { timeout: 15_000 }, async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'vitron-large-failure-'));

    try {
        await writeFile(path.join(root, 'package.json'), '{"name":"large-failure","type":"module"}');
        await writeFile(path.join(root, 'vitron.config.mjs'), "throw new Error('x'.repeat(200000) + 'END-OF-FAILURE');");

        const child = spawn(process.execPath, [cliPath, 'dev', '--root', root], {
            cwd: root,
            stdio: ['ignore', 'ignore', 'pipe'],
        });
        const chunks: Buffer[] = [];

        child.stderr.on('data', (chunk: Buffer) => {
            chunks.push(chunk);
        });
        // Leaving the pipe full when the CLI reaches its exit is what would lose the remainder.
        child.stderr.pause();
        setTimeout(() => child.stderr.resume(), 2000);

        const [status] = await once(child, 'close');

        expect(status).toBe(1);
        expect(Buffer.concat(chunks).includes('END-OF-FAILURE')).toBe(true);
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});

// Rolldown reports this failure as an unhandled rejection, so the process crash is what users can rely on.
it.each(['main', 'preload'])('exits nonzero when a %s plugin options hook throws', { timeout: 15_000 }, async (target) => {
    const root = await mkdtemp(path.join(tmpdir(), 'vitron-options-hook-'));

    try {
        await mkdir(path.join(root, 'src/main'), { recursive: true });
        await mkdir(path.join(root, 'src/preload'), { recursive: true });
        await writeFile(path.join(root, 'package.json'), '{"name":"options-hook","type":"module"}');
        await writeFile(path.join(root, 'src/main/index.ts'), 'export const value = 1;');
        await writeFile(path.join(root, 'src/preload/index.ts'), 'export const value = 1;');
        await writeFile(
            path.join(root, 'vitron.config.mjs'),
            `export default { ${target}Config: () => ({ plugins: [{ name: 'throwing', options() { throw new Error('options failed'); } }] }) };`,
        );

        const result = spawnSync(process.execPath, [cliPath, 'dev', '--root', root], {
            cwd: root,
            encoding: 'utf8',
            timeout: 10_000,
        });

        expect(result.error).toBeUndefined();
        expect(result.signal).toBeNull();
        expect(result.status).toBe(1);
        expect(`${result.stdout}${result.stderr}`).toContain('options failed');
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});

it('exits nonzero after initial main compilation fails without launching Electron', { timeout: 15_000 }, async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'vitron-invalid-main-'));

    try {
        await mkdir(path.join(root, 'src/main'), { recursive: true });
        await writeFile(path.join(root, 'package.json'), '{"name":"invalid-main"}');
        await writeFile(path.join(root, 'src/main/index.ts'), 'export const value = ;');

        const result = spawnSync(process.execPath, [cliPath, 'dev', '--root', root], {
            cwd: root,
            encoding: 'utf8',
            timeout: 10_000,
        });

        expect(result.error).toBeUndefined();
        expect(result.signal).toBeNull();
        expect(result.status).toBe(1);
        expect(result.stderr).toContain('src/main/index.ts');
        expect(stripVTControlCharacters(result.stderr)).toContain('export const value = ;');
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});

import { spawn, spawnSync } from 'node:child_process';
import {
    chmod,
    mkdir,
    mkdtemp,
    readFile,
    rm,
    writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { once } from 'node:events';
import { stripVTControlCharacters } from 'node:util';
import { expect, it, vi } from 'vitest';

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
        expect(`${result.stdout}${result.stderr}`).toContain('src/main/index.ts');
        expect(stripVTControlCharacters(`${result.stdout}${result.stderr}`)).toContain('export const value = ;');
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});


it.skipIf(process.platform === 'win32').each(['running', 'acquiring'])('owns SIGTERM while the Vite renderer is %s', { timeout: 15_000 }, async (stage) => {
    const root = await mkdtemp(path.join(tmpdir(), 'vitron-cli-signal-'));
    let child: ReturnType<typeof spawn> | undefined;

    try {
        await mkdir(path.join(root, 'src/main'), { recursive: true });
        await mkdir(path.join(root, 'src/renderer'), { recursive: true });
        await mkdir(path.join(root, 'bin'));
        await writeFile(path.join(root, 'package.json'), '{"name":"signal-fixture"}');
        await writeFile(path.join(root, 'src/main/index.ts'), 'export const value = "main";');
        await writeFile(path.join(root, 'src/renderer/index.html'), '<h1>renderer</h1>');
        await writeFile(path.join(root, 'vitron.config.cjs'), `module.exports = {
            rendererConfig(config) {
                config.configFile = false;
                config.plugins = [{ name: 'pending-acquisition', async configureServer() {
                    console.log('acquiring-renderer');
                    await new Promise(resolve => setTimeout(resolve, 300));
                    console.log('acquired-renderer');
                } }];
                return {};
            }
        };`);

        const executable = path.join(root, 'bin/electron');

        await writeFile(executable, '#!/usr/bin/env node\nconsole.log("electron-running:" + process.pid); setTimeout(() => {}, 5000);');
        await chmod(executable, 0o755);

        let output = '';

        child = spawn(process.execPath, [cliPath, 'dev'], {
            cwd: root,
            env: { ...process.env, PATH: `${path.join(root, 'bin')}${path.delimiter}${process.env.PATH}` },
            stdio: ['ignore', 'pipe', 'pipe'],
        });
        child.stdout!.on('data', (data: Buffer) => {
            output += data.toString();
        });
        child.stderr!.on('data', (data: Buffer) => {
            output += data.toString();
        });
        await vi.waitFor(() => expect(output).toContain(stage === 'running' ? 'electron-running' : 'acquiring-renderer'), { timeout: 5000 });

        const exited = once(child, 'exit', { signal: AbortSignal.timeout(5000) });

        child.kill('SIGTERM');
        await exited;
        expect(output).toContain('acquired-renderer');
        expect(child.exitCode, output).toBe(0);
        expect(child.signalCode).toBeNull();
    } finally {
        if (child?.exitCode === null && child.signalCode === null) {
            child.kill('SIGKILL');
        }

        await rm(root, { recursive: true, force: true });
    }
});

it('initializes a project with the built CLI assets and preserves existing files', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'vitron-cli-init-'));

    try {
        await writeFile(path.join(root, 'package.json'), '{"name":"keep-me"}');

        const result = spawnSync(process.execPath, [cliPath, 'init', '--root', root], {
            cwd: root,
            encoding: 'utf8',
            timeout: 10_000,
        });

        expect(result.status, `${result.stdout}${result.stderr}`).toBe(0);
        expect(await readFile(path.join(root, 'src/main/index.ts'), 'utf8')).toContain("from 'vitron/main'");
        expect(await readFile(path.join(root, 'src/preload/index.ts'), 'utf8')).toContain("from 'vitron/preload'");
        expect(await readFile(path.join(root, 'package.json'), 'utf8')).toBe('{"name":"keep-me"}');
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});

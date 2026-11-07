import { spawn as spawnNode } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import spawn from 'cross-spawn';
import { getRandomPort } from 'get-port-please';
import { createLogger } from 'vite';
import {
    afterEach,
    beforeEach,
    expect,
    it,
    vi,
} from 'vitest';
import { createElectron } from '../../../src/core/electron/create';
import { buildConfig } from '../../../src/config/utils/build';

vi.mock('cross-spawn', () => ({ default: vi.fn() }));

const children: {
    process: ChildProcess,
    output: string,
    errors: string
}[] = [];
let port: number;
let shutdownDelay: number;

beforeEach(async () => {
    port = await getRandomPort('127.0.0.1');
    shutdownDelay = 350;
    children.length = 0;
    vi.mocked(spawn).mockImplementation(() => {
        const child = spawnNode(process.execPath, [
            fileURLToPath(new URL('../../data/electron-lifecycle.cjs', import.meta.url)),
            `${port}`,
            `${shutdownDelay}`,
        ], { stdio: ['ignore', 'pipe', 'pipe'] });
        const state = {
            process: child,
            output: '',
            errors: '',
        };

        children.push(state);
        child.stdout!.on('data', (data: Buffer) => {
            state.output += data.toString();
        });
        child.stderr!.on('data', (data: Buffer) => {
            state.errors += data.toString();
        });

        return child;
    });
});

afterEach(async () => {
    await Promise.all(children.map(async ({ process: child }) => {
        if (child.exitCode !== null || child.signalCode !== null) {
            return;
        }

        child.removeAllListeners();

        const closed = once(child, 'close');

        child.kill('SIGKILL');
        await closed;
    }));
    vi.clearAllMocks();
});

async function ready(index: number) {
    await vi.waitFor(() => expect(children[index]?.output).toContain('ready'), { timeout: 5000 });

    const child = children[index].process;
    const response = await fetch(`http://127.0.0.1:${port}`);

    expect(await response.text()).toBe(`${child.pid}`);

    return child;
}

it.skipIf(process.platform === 'win32')('waits for the listening process to exit before stop resolves', async () => {
    const electron = createElectron(buildConfig({ rootPath: process.cwd() }), createLogger('silent'));

    electron.start();

    const original = await ready(0);

    await electron.stop();

    expect(original.exitCode).toBe(0);
    expect(electron.up()).toBe(false);
    await expect(fetch(`http://127.0.0.1:${port}`)).rejects.toThrow();
});

it.skipIf(process.platform === 'win32')('shares shutdown between concurrent restarts before replacing the port owner', async () => {
    const electron = createElectron(buildConfig({ rootPath: process.cwd() }), createLogger('silent'));

    electron.start();

    const original = await ready(0);

    await Promise.all([electron.restart(), electron.restart()]);

    expect(original.exitCode).toBe(0);

    const replacement = await ready(1);

    expect(replacement.pid).not.toBe(original.pid);
    expect(children).toHaveLength(2);
    expect(children.map((child) => child.errors).join('')).not.toContain('EADDRINUSE');
    await electron.stop();
    expect(replacement.exitCode).toBe(0);
});

it('allows a new process after the previous process closes unexpectedly', async () => {
    const electron = createElectron(buildConfig({ rootPath: process.cwd() }), createLogger('silent'));

    electron.start();

    const original = await ready(0);

    original.kill('SIGKILL');
    await vi.waitFor(() => expect(electron.up()).toBe(false), { timeout: 5000 });
    electron.start();

    const replacement = await ready(1);

    expect(replacement.pid).not.toBe(original.pid);
    await electron.stop();
});

it.skipIf(process.platform === 'win32')('force stops a process that does not finish graceful shutdown', { timeout: 15_000 }, async () => {
    shutdownDelay = 60_000;

    const electron = createElectron(buildConfig({ rootPath: process.cwd() }), createLogger('silent'));

    electron.start();

    const original = await ready(0);

    await electron.stop();

    expect(original.signalCode).toBe('SIGKILL');
    expect(electron.up()).toBe(false);
    await expect(fetch(`http://127.0.0.1:${port}`)).rejects.toThrow();
});

it.skipIf(process.platform === 'win32')('keeps the process stopped when shutdown interrupts a restart', async () => {
    const electron = createElectron(buildConfig({ rootPath: process.cwd() }), createLogger('silent'));

    electron.start();
    await ready(0);

    const restarting = electron.restart();

    await Promise.all([restarting, electron.stop()]);

    expect(electron.up()).toBe(false);
    await expect(fetch(`http://127.0.0.1:${port}`)).rejects.toThrow();
});

it('rejects initial Electron launch failure instead of reporting successful startup', async () => {
    vi.mocked(spawn).mockImplementationOnce(() => spawnNode(`/vitron-missing-electron-${process.pid}`));

    const electron = createElectron(buildConfig({ rootPath: process.cwd() }), createLogger('silent'));

    await expect(electron.start()).rejects.toMatchObject({ code: 'ENOENT' });
    await vi.waitFor(() => expect(electron.up()).toBe(false));
});

it('rejects replacement launch failure after the original Electron has closed', async () => {
    const electron = createElectron(buildConfig({ rootPath: process.cwd() }), createLogger('silent'));

    await electron.start();

    const original = await ready(0);

    vi.mocked(spawn).mockImplementationOnce(() => spawnNode(`/vitron-missing-electron-${process.pid}`));
    await expect(electron.restart()).rejects.toMatchObject({ code: 'ENOENT' });
    expect(original.exitCode !== null || original.signalCode !== null).toBe(true);
    await vi.waitFor(() => expect(electron.up()).toBe(false));
});

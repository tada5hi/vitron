import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Server } from 'node:http';
import type { BrowserWindow } from 'electron';
import { expect, it, vi } from 'vitest';
import { serve } from '../../../src/exports/main/module';

vi.mock('electron', () => ({ app: { isPackaged: true } }));

it('serves packaged renderer files and returns 404 for missing files', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'vitron-renderer-'));
    let close: (() => Promise<void>) | undefined;
    let loaded: ((url: string) => void) | undefined;
    const ready = new Promise<string>((resolve) => {
        loaded = resolve;
    });
    const window = {
        loadURL: async (url: string) => {
            loaded?.(url);
        },
        on: (_event: string, listener: () => Promise<void>) => {
            close = listener;
        },
    };

    try {
        await writeFile(path.join(directory, 'index.html'), '<h1>renderer</h1>');
        await writeFile(path.join(directory, 'app.js'), 'window.ready = true;');
        await serve(window as unknown as BrowserWindow, { directory });

        const url = await ready;

        expect(new URL(url).hostname).toBe('127.0.0.1');

        const page = await fetch(`${url}/index.html`);
        const script = await fetch(`${url}/app.js`);
        const missing = await fetch(`${url}/missing.js`);

        expect(page.status).toBe(200);
        expect(await page.text()).toBe('<h1>renderer</h1>');
        expect(script.status).toBe(200);
        expect(await script.text()).toBe('window.ready = true;');
        expect(missing.status).toBe(404);
    } finally {
        await close?.();
        await rm(directory, { recursive: true, force: true });
    }
});

it('rejects startup when the local renderer server cannot listen', async () => {
    const failure = new Error('listen failed');
    const listen = vi.spyOn(Server.prototype, 'listen').mockImplementationOnce(function(this: Server) {
        queueMicrotask(() => this.emit('error', failure));

        return this;
    });
    let onClose: (() => Promise<void>) | undefined;
    const window = {
        on: (_event: string, listener: () => Promise<void>) => {
            onClose = listener;
        },
        loadURL: vi.fn(),
    };

    try {
        await expect(serve(window as unknown as BrowserWindow, { directory: '.' })).rejects.toThrow('listen failed');
        expect(window.loadURL).not.toHaveBeenCalled();
        expect(onClose).toBeTypeOf('function');
        await onClose?.();
    } finally {
        listen.mockRestore();
    }
});

it('closes the local server when the renderer fails to load', async () => {
    const close = vi.spyOn(Server.prototype, 'close');
    const window = {
        on: vi.fn(),
        loadURL: vi.fn(async () => {
            throw new Error('load failed');
        }),
    };

    try {
        await expect(serve(window as unknown as BrowserWindow, { directory: '.' })).rejects.toThrow('load failed');
        expect(close).toHaveBeenCalledOnce();
    } finally {
        close.mockRestore();
    }
});

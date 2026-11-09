import {
    mkdir,
    mkdtemp,
    rm,
    truncate,
    writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';
import type { IncomingMessage } from 'node:http';
import { Server, get } from 'node:http';
import type { BrowserWindow } from 'electron';
import { expect, it, vi } from 'vitest';
import { serve } from '../../../src/exports/main/module';

vi.mock('electron', () => ({ app: { isPackaged: true } }));

it('serves packaged renderer index, assets, MIME, HEAD and byte ranges', async () => {
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
        await mkdir(path.join(directory, 'about'));
        await writeFile(path.join(directory, 'about/index.htm'), 'about');
        await serve(window as unknown as BrowserWindow, { directory });

        const url = await ready;

        expect(new URL(url).hostname).toBe('127.0.0.1');

        const page = await fetch(`${url}/`);
        const index = await fetch(`${url}/index.html`);
        const about = await fetch(`${url}/about`);
        const head = await fetch(`${url}/app.js`, { method: 'HEAD' });
        const range = await fetch(`${url}/app.js`, { headers: { Range: 'bytes=7-11' } });
        const script = await fetch(`${url}/app.js`);
        const cached = await fetch(`${url}/app.js`, { headers: { 'If-None-Match': script.headers.get('etag')! } });
        const missing = await fetch(`${url}/missing.js`);

        expect(page.status).toBe(200);
        expect(await page.text()).toBe('<h1>renderer</h1>');
        expect(page.headers.get('content-type')).toContain('text/html');
        expect(await index.text()).toBe('<h1>renderer</h1>');
        expect(await about.text()).toBe('about');
        expect(script.status).toBe(200);
        expect(script.headers.get('content-type')).toMatch(/(text|application)\/javascript/);
        expect(head.status).toBe(200);
        expect(head.headers.get('content-length')).toBe('20');
        expect(await head.text()).toBe('');
        expect(range.status).toBe(206);
        expect(range.headers.get('content-range')).toBe('bytes 7-11/20');
        expect(await range.text()).toBe('ready');
        expect(await script.text()).toBe('window.ready = true;');
        expect(script.headers.get('cache-control')).toBe('public,max-age=0,must-revalidate');
        expect(cached.status).toBe(304);
        expect(await cached.text()).toBe('');
        expect(missing.status).toBe(404);

        await close?.();

        const rebound = new Server();

        try {
            await new Promise<void>((resolve, reject) => {
                rebound.once('error', reject);
                rebound.listen(Number(new URL(url).port), '127.0.0.1', resolve);
            });
        } finally {
            rebound.close();
        }
    } finally {
        await close?.();
        await rm(directory, { recursive: true, force: true });
    }
});

it('ignores unsupported range forms instead of returning incorrect partial bytes', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'vitron-range-'));
    let close: (() => Promise<void>) | undefined;
    let url = '';
    const window = {
        loadURL: async (value: string) => {
            url = value;
        },
        on: (_event: string, listener: () => Promise<void>) => {
            close = listener;
        },
    };

    try {
        await writeFile(path.join(directory, 'asset.txt'), '0123456789');
        await serve(window as unknown as BrowserWindow, { directory });

        const suffix = await fetch(`${url}/asset.txt`, { headers: { Range: 'bytes=-3' } });

        expect(suffix.status).toBe(206);
        expect(suffix.headers.get('content-range')).toBe('bytes 7-9/10');
        expect(await suffix.text()).toBe('789');

        const multiple = await fetch(`${url}/asset.txt`, { headers: { Range: 'bytes=0-1,8-9' } });

        expect(multiple.status).toBe(200);
        expect(multiple.headers.get('content-range')).toBeNull();
        expect(await multiple.text()).toBe('0123456789');
    } finally {
        await close?.();
        await rm(directory, { recursive: true, force: true });
    }
});

// Use raw HTTP paths so URL normalization cannot hide traversal attempts.
async function status(url: string, requestPath: string): Promise<number | undefined> {
    return new Promise((resolve, reject) => {
        const request = get(url, { path: requestPath }, (response) => {
            response.resume();
            response.once('end', () => resolve(response.statusCode));
        });

        request.once('error', reject);
    });
}

it('confines packaged file requests to visible files inside the renderer directory', async () => {
    const parent = await mkdtemp(path.join(tmpdir(), 'vitron-confined-'));
    const directory = path.join(parent, 'renderer');
    let close: (() => Promise<void>) | undefined;
    let url = '';
    const window = {
        loadURL: async (value: string) => {
            url = value;
        },
        on: (_event: string, listener: () => Promise<void>) => {
            close = listener;
        },
    };

    try {
        await mkdir(directory);
        await mkdir(`${directory}-private`);
        await mkdir(path.join(directory, '.hidden'));
        await mkdir(path.join(directory, '.well-known'));
        await writeFile(path.join(directory, 'index.html'), 'safe');
        await writeFile(path.join(directory, '.secret'), 'hidden');
        await writeFile(path.join(directory, '.hidden/token'), 'hidden');
        await writeFile(path.join(directory, '.well-known/asset'), 'public');
        await writeFile(path.join(parent, 'secret.txt'), 'outside');
        await writeFile(path.join(`${directory}-private`, 'secret.txt'), 'sibling');
        await serve(window as unknown as BrowserWindow, { directory });

        for (const requestPath of [
            '/../secret.txt',
            '/%2e%2e%2fsecret.txt',
            '/..%5csecret.txt',
            '/%2e%2e%2frenderer-private%2fsecret.txt',
            '/.secret',
            '/%2ehidden/token',
            '/%00',
            '/%zz',
            '/missing.js',
        ]) {
            expect(await status(url, requestPath), requestPath).toBe(404);
        }

        expect(await status(url, '/index.html')).toBe(200);
        expect(await status(url, '/.well-known/asset')).toBe(200);
    } finally {
        await close?.();
        await rm(parent, { recursive: true, force: true });
    }
});

it('releases a stalled transfer and stops serving when the window closes', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'vitron-stream-'));
    let close: (() => Promise<void>) | undefined;
    let url = '';
    let response: IncomingMessage | undefined;
    const window = {
        loadURL: async (value: string) => {
            url = value;
        },
        on: (_event: string, listener: () => Promise<void>) => {
            close = listener;
        },
    };

    try {
        await writeFile(path.join(directory, 'large.bin'), '');
        await truncate(path.join(directory, 'large.bin'), 32 * 1024 * 1024);
        await serve(window as unknown as BrowserWindow, { directory });
        response = await new Promise<IncomingMessage>((resolve, reject) => {
            get(`${url}/large.bin`, resolve).once('error', reject);
        });
        response.pause();

        expect(response.statusCode).toBe(200);

        const released = new Promise<void>((resolve) => {
            response!.once('error', () => undefined);
            response!.once('close', () => resolve());
        });

        await close?.();
        response.resume();
        await released;

        expect(response.complete).toBe(false);

        await expect(fetch(`${url}/large.bin`)).rejects.toThrow();
    } finally {
        response?.destroy();
        await close?.();
        await rm(directory, { recursive: true, force: true });
    }
});

it('answers requests with a server error and no unhandled rejection when the renderer directory is missing', async () => {
    const parent = await mkdtemp(path.join(tmpdir(), 'vitron-missing-'));
    const unhandled = vi.fn();
    let close: (() => Promise<void>) | undefined;
    let url = '';
    const window = {
        loadURL: async (value: string) => {
            url = value;
        },
        on: (_event: string, listener: () => Promise<void>) => {
            close = listener;
        },
    };

    process.on('unhandledRejection', unhandled);

    try {
        await serve(window as unknown as BrowserWindow, { directory: path.join(parent, 'missing') });

        expect(await status(url, '/index.html')).toBe(500);
        await new Promise((resolve) => {
            setTimeout(resolve, 50);
        });
        expect(unhandled).not.toHaveBeenCalled();
    } finally {
        process.off('unhandledRejection', unhandled);
        await close?.();
        await rm(parent, { recursive: true, force: true });
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

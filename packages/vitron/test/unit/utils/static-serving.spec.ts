import { createReadStream } from 'node:fs';
import type { ReadStream } from 'node:fs';
import type * as nodeFs from 'node:fs';
import {
    mkdir,
    mkdtemp,
    rm,
    symlink,
    truncate,
    writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { IncomingMessage } from 'node:http';
import { Server, get } from 'node:http';
import type { BrowserWindow } from 'electron';
import { expect, it, vi } from 'vitest';
import { serve } from '../../../src/exports/main/module';

vi.mock('electron', () => ({ app: { isPackaged: true } }));
vi.mock('node:fs', async (importOriginal) => {
    const actual = await importOriginal<typeof nodeFs>();

    return { ...actual, createReadStream: vi.fn(actual.createReadStream) };
});

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
        expect(cached.headers.get('etag')).toBe(script.headers.get('etag'));
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

        for (const range of ['bytes=-3', 'bytes=0-1,8-9']) {
            const response = await fetch(`${url}/asset.txt`, { headers: { Range: range } });

            expect(response.status, range).toBe(200);
            expect(response.headers.get('content-range'), range).toBeNull();
            expect(await response.text(), range).toBe('0123456789');
        }
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
        await symlink(path.join(parent, 'secret.txt'), path.join(directory, 'escape.txt'));
        await symlink(`${directory}-private`, path.join(directory, 'escape-dir'));
        await symlink(path.join(directory, 'index.html'), path.join(directory, 'inside.html'));
        await symlink(path.join(directory, '.secret'), path.join(directory, 'hidden-link.txt'));
        await serve(window as unknown as BrowserWindow, { directory });

        for (const requestPath of [
            '/../secret.txt',
            '/%2e%2e%2fsecret.txt',
            '/..%5csecret.txt',
            '/%2e%2e%2frenderer-private%2fsecret.txt',
            '/escape.txt',
            '/hidden-link.txt',
            '/escape-dir/secret.txt',
            '/.secret',
            '/%2ehidden/token',
            '/%00',
            '/%zz',
            '/missing.js',
        ]) {
            expect(await status(url, requestPath), requestPath).toBe(404);
        }

        expect(await status(url, '/inside.html')).toBe(200);
        expect(await status(url, '/.well-known/asset')).toBe(200);
    } finally {
        await close?.();
        await rm(parent, { recursive: true, force: true });
    }
});

it('bounds file reads and releases a stalled transfer when the window closes', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'vitron-stream-'));
    let close: (() => Promise<void>) | undefined;
    let url = '';
    let response: IncomingMessage | undefined;
    const opened = Promise.withResolvers<ReadStream>();
    const actual = await vi.importActual<typeof nodeFs>('node:fs');
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
        vi.mocked(createReadStream).mockImplementationOnce((...args) => {
            const stream = actual.createReadStream(...args);

            opened.resolve(stream);

            return stream;
        });
        await serve(window as unknown as BrowserWindow, { directory });
        response = await new Promise<IncomingMessage>((resolve, reject) => {
            get(`${url}/large.bin`, resolve).once('error', reject);
        });
        response.pause();

        const stream = await opened.promise;

        for (let sample = 0; sample < 2; sample++) {
            await new Promise((resolve) => {
                setTimeout(resolve, 200);
            });
            expect(stream.bytesRead).toBeGreaterThan(0);
            expect(stream.bytesRead).toBeLessThan(8 * 1024 * 1024);
        }

        expect(response.statusCode).toBe(200);

        const stopped = close?.();

        await vi.waitFor(() => expect(stream.closed).toBe(true));
        await stopped;
    } finally {
        response?.destroy();
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

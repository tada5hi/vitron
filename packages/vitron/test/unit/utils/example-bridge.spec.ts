import { expect, it, vi } from 'vitest';

const { provide, invoke } = vi.hoisted(() => ({
    provide: vi.fn(),
    invoke: vi.fn(async () => 'pong'),
}));

vi.mock('vitron/preload', () => ({ provide }));
vi.mock('electron', () => ({ ipcRenderer: { invoke } }));

it('exposes a narrow ping bridge supported by current Electron', async () => {
    await import('../../../../../examples/vanilla/src/preload/index');

    expect(provide).toHaveBeenCalledWith('vitron', { ping: expect.any(Function) });

    const api = provide.mock.calls[0][1];

    expect(Object.keys(api)).toEqual(['ping']);
    await expect(api.ping()).resolves.toBe('pong');
    expect(invoke).toHaveBeenCalledWith('ping');
});

import { expect, it, vi } from 'vitest';
import { buildMainApp } from '../../../src/apps/main';
import { buildPreloadApp } from '../../../src/apps/preload';
import { buildRendererApp } from '../../../src/apps/renderer';
import { BuildCommand } from '../../../src/cli/build';

const { sync } = vi.hoisted(() => ({ sync: vi.fn() }));

vi.mock('cross-spawn', () => ({ default: { sync } }));
vi.mock('../../../src/config', () => ({ createConfig: async () => ({ set: vi.fn() }) }));
vi.mock('../../../src/apps/main', () => ({ buildMainApp: vi.fn() }));
vi.mock('../../../src/apps/preload', () => ({ buildPreloadApp: vi.fn() }));
vi.mock('../../../src/apps/renderer', () => ({ buildRendererApp: vi.fn() }));
vi.mock('../../../src/apps/utils', () => ({ clearBuildDirectory: vi.fn(), createBuildDirectory: vi.fn() }));

it('propagates packaging failure instead of reporting a successful build', async () => {
    sync.mockReturnValueOnce({ status: 1 });

    await expect(new BuildCommand().handler({
        _: [],
        $0: 'vitron',
        root: '.',
        flags: [],
    }))
        .rejects.toThrow('electron-builder exited with status 1.');
});

it('propagates a missing packaging executable', async () => {
    const error = new Error('electron-builder not found');

    sync.mockReturnValueOnce({ error, status: null });

    await expect(new BuildCommand().handler({
        _: [],
        $0: 'vitron',
        root: '.',
        flags: [],
    })).rejects.toBe(error);
});

it('does not build main, preload or package after a renderer failure', async () => {
    const error = new Error('renderer failed');

    vi.clearAllMocks();
    vi.mocked(buildRendererApp).mockRejectedValueOnce(error);

    await expect(new BuildCommand().handler({
        _: [],
        $0: 'vitron',
        root: '.',
        flags: [],
    })).rejects.toBe(error);

    expect(buildMainApp).not.toHaveBeenCalled();
    expect(buildPreloadApp).not.toHaveBeenCalled();
    expect(sync).not.toHaveBeenCalled();
});

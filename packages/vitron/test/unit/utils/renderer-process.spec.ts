import process from 'node:process';
import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';
import { spawnRendererProcess } from '../../../src/apps/renderer/ps';
import { Framework } from '../../../src/utils';

const { spawn } = vi.hoisted(() => ({ spawn: vi.fn() }));

vi.mock('cross-spawn', () => ({ default: spawn }));

const rootPath = '/project';

function createConfig(values: Record<string, any>) {
    const all = {
        rootPath,
        rendererDirectory: 'renderer',
        port: 9000,
        ...values,
    };

    return { get: (key?: string) => (key ? (all as any)[key] : all) } as any;
}

describe.each([
    ['linux', true],
    ['darwin', true],
    ['win32', false],
])('spawnRendererProcess on %s', (platform, detached) => {
    const original = Object.getOwnPropertyDescriptor(process, 'platform')!;

    beforeEach(() => {
        spawn.mockReset();
        Object.defineProperty(process, 'platform', { ...original, value: platform });
    });

    afterEach(() => {
        Object.defineProperty(process, 'platform', original);
    });

    it('runs a custom command through a shell from the project root', () => {
        const child = {};

        spawn.mockReturnValueOnce(child);

        const result = spawnRendererProcess(createConfig({ rendererDevCommand: () => 'custom dev --flag' }));

        expect(result).toBe(child);
        expect(spawn.mock.calls).toEqual([['custom dev --flag', {
            shell: true,
            cwd: rootPath,
            stdio: 'inherit',
            detached,
        }]]);
    });

    it.each([
        [Framework.NUXT, '3.0.0', 'nuxi'],
        [Framework.NUXT, '2.17.0', 'nuxt'],
        [Framework.NEXT, '16.0.0', 'next'],
    ])('runs %s %s from the project root', (name, version, bin) => {
        spawnRendererProcess(createConfig({ framework: { name, version } }));

        expect(spawn).toHaveBeenCalledTimes(1);
        expect(spawn.mock.calls[0][0]).toBe(bin);
        expect(spawn.mock.calls[0][2]).toEqual({
            cwd: rootPath,
            stdio: 'inherit',
            detached,
        });
    });
});

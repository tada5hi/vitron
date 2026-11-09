import {
    afterEach,
    expect,
    it,
    vi,
} from 'vitest';
import { DevCommand } from '../../../src/cli/dev';

const { runDevelopmentSession } = vi.hoisted(() => ({ runDevelopmentSession: vi.fn() }));

vi.mock('../../../src/apps/dev', () => ({ runDevelopmentSession }));
vi.mock('../../../src/config', () => ({ createConfig: vi.fn(async () => ({ get: vi.fn(), set: vi.fn() })) }));

afterEach(() => {
    runDevelopmentSession.mockReset();
});

it.each(['SIGINT', 'SIGTERM', 'SIGHUP', 'SIGQUIT'] as const)('aborts the session on %s and removes its handler afterwards', async (signal) => {
    const before = process.listenerCount(signal);
    let release!: () => void;

    runDevelopmentSession.mockImplementationOnce(() => new Promise<void>((resolve) => {
        release = resolve;
    }));

    const running = new DevCommand().handler({ root: '/project', port: null } as any);

    await vi.waitFor(() => expect(runDevelopmentSession).toHaveBeenCalled());

    const session: AbortSignal = runDevelopmentSession.mock.calls[0][2];

    expect(process.listenerCount(signal)).toBe(before + 1);

    // Calling the handler directly keeps the signal away from anything else listening in this worker.
    (process.listeners(signal).at(-1) as () => void)();
    expect(session.aborted).toBe(true);

    release();
    await running;

    expect(process.listenerCount(signal)).toBe(before);
});

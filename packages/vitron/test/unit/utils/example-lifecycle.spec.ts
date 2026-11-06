import { 
    afterEach,
    beforeEach, 
    expect, 
    it, 
    vi, 
} from 'vitest';

const state = vi.hoisted(() => ({
    listeners: new Map<string, () => void>(),
    windows: [] as object[],
    serve: vi.fn(async () => {}),
    handle: vi.fn(),
}));

vi.mock('electron', () => ({
    app: {
        whenReady: async () => {},
        on: (event: string, listener: () => void) => state.listeners.set(event, listener),
        quit: vi.fn(),
    },
    ipcMain: { handle: state.handle },
    BrowserWindow: class {
        constructor() {
            state.windows.push(this);
        }

        static getAllWindows() {
            return state.windows;
        }

        isDestroyed() {
            return !state.windows.includes(this);
        }

        destroy() {
            state.windows = state.windows.filter((window) => window !== this);
        }
    },
}));
vi.mock('vitron/main', () => ({ serve: state.serve }));

beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    state.listeners.clear();
    state.windows = [];
    state.serve.mockReset();
    state.serve.mockResolvedValue(undefined);
});

afterEach(() => {
    vi.restoreAllMocks();
});

it.each(['vanilla', 'nuxt', 'scaffold'])('reopens the %s example on activation without duplicate windows', async (example) => {
    if (example === 'scaffold') {
        await import('../../../assets/templates/src/main/index.ts');
    } else {
        await import(`../../../../../examples/${example}/src/main/index.ts`);
    }

    await vi.waitFor(() => expect(state.serve).toHaveBeenCalledOnce());

    expect(state.listeners.has('activate')).toBe(true);
    state.listeners.get('activate')?.();
    expect(state.serve).toHaveBeenCalledOnce();

    state.windows = [];
    state.listeners.get('activate')?.();
    await vi.waitFor(() => expect(state.serve).toHaveBeenCalledTimes(2));
    expect(state.handle).toHaveBeenCalledTimes(example === 'vanilla' ? 1 : 0);
});

it.each(['vanilla', 'nuxt', 'scaffold'])('recovers the %s example after initial and activation failures', async (example) => {
    const failure = new Error('Renderer unavailable');
    const report = vi.spyOn(console, 'error').mockImplementation(() => {});

    state.serve.mockRejectedValueOnce(failure);

    if (example === 'scaffold') {
        await import('../../../assets/templates/src/main/index.ts');
    } else {
        await import(`../../../../../examples/${example}/src/main/index.ts`);
    }

    await vi.waitFor(() => expect(report).toHaveBeenCalledWith(failure));
    expect(state.windows).toHaveLength(0);
    expect(state.listeners.has('activate')).toBe(true);

    state.serve.mockRejectedValueOnce(failure);
    state.listeners.get('activate')?.();
    await vi.waitFor(() => expect(report).toHaveBeenCalledTimes(2));
    expect(state.windows).toHaveLength(0);

    state.listeners.get('activate')?.();
    await vi.waitFor(() => expect(state.serve).toHaveBeenCalledTimes(3));
    expect(state.windows).toHaveLength(1);
});

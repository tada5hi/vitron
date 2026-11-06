import { 
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
    },
}));
vi.mock('vitron/main', () => ({ serve: state.serve }));

beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    state.listeners.clear();
    state.windows = [];
});

it.each(['vanilla', 'nuxt'])('reopens the %s example on activation without duplicate windows', async (example) => {
    await import(`../../../../../examples/${example}/src/main/index.ts`);
    await vi.waitFor(() => expect(state.serve).toHaveBeenCalledOnce());

    expect(state.listeners.has('activate')).toBe(true);
    state.listeners.get('activate')?.();
    expect(state.serve).toHaveBeenCalledOnce();

    state.windows = [];
    state.listeners.get('activate')?.();
    await vi.waitFor(() => expect(state.serve).toHaveBeenCalledTimes(2));
    expect(state.handle).toHaveBeenCalledTimes(example === 'vanilla' ? 1 : 0);
});

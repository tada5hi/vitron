import { contextBridge } from 'electron';

if (process.contextIsolated) {
    try {
        contextBridge.exposeInMainWorld('foo', 'bar');
    } catch (error) {
        console.error(error);
    }
} else {
    window.foo = 'bar';
}

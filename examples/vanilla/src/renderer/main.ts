import type { IpcRenderer } from 'electron';
import { inject } from 'vitron/renderer';

const ipcRenderer = inject<IpcRenderer>('foo');
setTimeout(async () => {
    const output = await ipcRenderer.invoke('ping');
    console.log(output);
}, 0);

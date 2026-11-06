import { provide } from 'vitron/preload';
import { ipcRenderer } from 'electron';

provide('vitron', { ping: () => ipcRenderer.invoke('ping') });

import { provide } from 'vitron/preload';
import { ipcRenderer } from 'electron';

provide('foo', ipcRenderer);

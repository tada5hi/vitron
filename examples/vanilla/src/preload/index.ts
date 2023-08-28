import { provide } from 'vitron/provide';
import { ipcRenderer } from 'electron';

provide('foo', ipcRenderer);

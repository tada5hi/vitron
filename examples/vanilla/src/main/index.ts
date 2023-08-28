import path from 'node:path';
import process from 'node:process';
import { serve } from '@vitron/main';
import { BrowserWindow, app, ipcMain } from 'electron';

app.on('window-all-closed', () => {
    // On mac-os it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    if (process.platform !== 'darwin') app.quit();
});

let mainWindow : BrowserWindow;

(async () => {
    await app.whenReady();

    mainWindow = new BrowserWindow({
        height: 768,
        width: 1024,
        autoHideMenuBar: true,
        title: 'Vitron',
        webPreferences: {
            preload: path.join(`${__dirname}/../preload/index.js`),
            devTools: true,
            sandbox: false,
        },
    });

    await serve(mainWindow, {
        directory: path.join(`${__dirname}/../renderer/`),
        env: process.env.NODE_ENV || 'production',
        port: process.env.PORT,
    });

    ipcMain.handle('ping', () => 'pong');
})();

app.on('window-all-closed', () => {
    app.quit();
});

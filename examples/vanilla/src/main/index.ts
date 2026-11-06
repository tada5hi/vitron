import path from 'node:path';
import process from 'node:process';
import { serve } from 'vitron/main';
import { BrowserWindow, app, ipcMain } from 'electron';

app.on('window-all-closed', () => {
    // On mac-os it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

let mainWindow : BrowserWindow;

async function createWindow() {
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
        port: process.env.PORT,
    });
}

app.whenReady().then(async () => {
    ipcMain.handle('ping', () => 'pong');

    await createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            void createWindow();
        }
    });
});

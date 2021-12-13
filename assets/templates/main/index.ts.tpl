import {app, BrowserWindow, ipcMain, dialog, clipboard, shell} from 'electron';
import {registerRenderedFiles} from 'electron-adapter';

import {watchFile} from "fs";
import * as path from "path";

app.on('window-all-closed', () => {
    // On mac-os it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    if (process.platform !== 'darwin') app.quit();
});

const isProd: boolean = process.env.NODE_ENV === 'production';

if (!isProd) {
    watchFile(__filename, () => {
        app.exit(0);
    });
}

let mainWindow : BrowserWindow;

(async () => {
    if(isProd) {
        const directory = __dirname.split(path.sep).pop();
        registerRenderedFiles({directory: directory || {{buildTempDirectory}});
    }

    await app.whenReady();

    mainWindow = new BrowserWindow({
        height: 768,
        width: 1024,
        autoHideMenuBar: true,
        title: 'PHT - LocalTool',
        webPreferences: {
            devTools: !app.isPackaged,
            nodeIntegration: true,
            contextIsolation: false,
        }
    });

    if (isProd) {
        await mainWindow.loadURL(`app://-`);
    } else {
        const port = process.env.ELECTRON_MAIN_PORT || 9000;
        await mainWindow.loadURL(`http://localhost:${port}`);
    }
})();

app.on('window-all-closed', () => {
    app.quit();
});

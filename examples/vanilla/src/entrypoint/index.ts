import path from 'node:path';
import { BrowserWindow, app } from 'electron';
import { registerRenderedFiles } from './rendered-files';

app.on('window-all-closed', () => {
    // On mac-os it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    if (process.platform !== 'darwin') app.quit();
});

const isProd: boolean = process.env.NODE_ENV === 'production';

let mainWindow : BrowserWindow;

(async () => {
    if (isProd) {
        registerRenderedFiles({ directory: '.vitron/renderer' });
    }

    await app.whenReady();

    mainWindow = new BrowserWindow({
        height: 768,
        width: 1024,
        autoHideMenuBar: true,
        title: 'Vitron',
        webPreferences: {
            preload: path.join(`${__dirname}/../preload/index.js`),
            devTools: true,
            sandbox: true,
        },
    });

    if (isProd) {
        await mainWindow.loadURL('app://-');
    } else {
        const port = process.env.PORT || 9000;
        await mainWindow.loadURL(`http://localhost:${port}`);
    }
})();

app.on('window-all-closed', () => {
    app.quit();
});

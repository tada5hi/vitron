import { expect, replaceSource, test } from '../../../../test/e2e/fixtures';

test.use({ exampleName: 'vanilla' });

test('develops a real Electron renderer and applies source updates', async ({ example }) => {
    let page = await example.startDev();

    await expect(page.locator('#app')).toHaveText('Vitron is running. IPC response: pong');
    await replaceSource(example.root, 'src/renderer/main.ts', 'Vitron is running.', 'Renderer updated.');
    await expect(page.locator('#app')).toHaveText('Renderer updated. IPC response: pong');

    await replaceSource(example.root, 'src/preload/index.ts', "ipcRenderer.invoke('ping')", "ipcRenderer.invoke('ping').then((value) => `preload: ${value}`)");
    await expect(page.locator('#app')).toHaveText('Renderer updated. IPC response: preload: pong');

    const browser = page.context().browser()!;

    await replaceSource(example.root, 'src/main/index.ts', "() => 'pong'", "() => 'main updated'");
    await expect.poll(() => browser.isConnected()).toBe(false);
    page = await example.connect();
    await expect(page.locator('#app')).toHaveText('Renderer updated. IPC response: preload: main updated');
    await example.stopDev();
});

test('ends development when the app quits', async ({ example }) => {
    const page = await example.startDev();

    await expect(page.locator('#app')).toHaveText('Vitron is running. IPC response: pong');
    await example.quitElectron();
});

test('runs an unpacked production app without a development server', async ({ example }) => {
    const { electron, page } = await example.startBuilt();

    expect(await electron.evaluate(({ app }) => app.isPackaged)).toBe(true);
    await expect(page).toHaveURL(/^http:\/\/127\.0\.0\.1:\d+\//);
    await expect(page.locator('#app')).toHaveText('Vitron is running. IPC response: pong');

    const response = await page.request.get(new URL('/missing-renderer-file', page.url()).href);

    expect(response.status()).toBe(404);

    // Exercise forced teardown when an application prevents graceful quit.
    await electron.evaluate(({ app }) => {
        app.on('before-quit', (event) => event.preventDefault());
    });
});

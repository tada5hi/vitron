import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { expect, test } from './fixtures';

async function replaceSource(root: string, file: string, before: string, after: string) {
    const filePath = path.join(root, file);
    const source = await readFile(filePath, 'utf8');

    expect(source).toContain(before);
    await writeFile(filePath, source.replace(before, after));
}

for (const exampleName of ['vanilla', 'nuxt'] as const) {
    test.describe(exampleName, () => {
        test.use({ exampleName });

        test('develops a real Electron renderer and applies source updates', async ({ example }) => {
            let page = await example.startDev();

            if (exampleName === 'vanilla') {
                await expect(page.locator('#app')).toHaveText('Vitron is running. IPC response: pong');
                await replaceSource(example.root, 'src/renderer/main.ts', 'Vitron is running.', 'Renderer updated.');
                await expect(page.locator('#app')).toHaveText('Renderer updated. IPC response: pong');

                await replaceSource(example.root, 'src/preload/index.ts', "ipcRenderer.invoke('ping')", "ipcRenderer.invoke('ping').then((value) => `preload: ${value}`)");
                await expect(page.locator('#app')).toHaveText('Renderer updated. IPC response: preload: pong');

                const disconnected = new Promise<void>((resolve) => {
                    page.context().browser()!.once('disconnected', () => resolve());
                });

                await replaceSource(example.root, 'src/main/index.ts', "() => 'pong'", "() => 'main updated'");
                await disconnected;
                page = await example.connect();
                await expect(page.locator('#app')).toHaveText('Renderer updated. IPC response: preload: main updated');
            } else {
                await expect(page.getByRole('heading', { name: /^Nuxt \d/, level: 1 })).toBeVisible();
                await replaceSource(example.root, 'src/renderer/app.vue', '<NuxtWelcome />', '<h1>Nuxt renderer updated</h1>');
                await expect(page.getByRole('heading', { name: 'Nuxt renderer updated' })).toBeVisible();
            }
        });

        test('runs an unpacked production app without a development server', async ({ example }) => {
            const { electron, page } = await example.startBuilt();

            expect(await electron.evaluate(({ app }) => app.isPackaged)).toBe(true);
            await expect(page).toHaveURL(/^http:\/\/127\.0\.0\.1:\d+\//);

            if (exampleName === 'vanilla') {
                await expect(page.locator('#app')).toHaveText('Vitron is running. IPC response: pong');
            } else {
                await expect(page.getByRole('heading', { name: /^Nuxt \d/, level: 1 })).toBeVisible();
            }

            const response = await page.request.get(new URL('/missing-renderer-file', page.url()).href);

            expect(response.status()).toBe(404);

            if (exampleName === 'vanilla') {
                // Exercise forced teardown when an application prevents graceful quit.
                await electron.evaluate(({ app }) => {
                    app.on('before-quit', (event) => event.preventDefault());
                });
            }
        });
    });
}

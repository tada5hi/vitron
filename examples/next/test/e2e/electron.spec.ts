import { expect, replaceSource, test } from '../../../../test/e2e/fixtures';

test.use({ exampleName: 'next' });

test('develops a real Electron renderer and applies source updates', async ({ example }) => {
    const page = await example.startDev();

    await expect(page.getByRole('heading', { name: /^Next \d/, level: 1 })).toBeVisible();
    await replaceSource(example.root, 'src/renderer/app/page.tsx', '<h1>Next {process.env.NEXT_VERSION}</h1>', '<h1>Next renderer updated</h1>');
    await expect(page.getByRole('heading', { name: 'Next renderer updated' })).toBeVisible();
    await example.stopDev();
});

test('runs an unpacked production app without a development server', async ({ example }) => {
    const { electron, page } = await example.startBuilt();

    expect(await electron.evaluate(({ app }) => app.isPackaged)).toBe(true);
    await expect(page).toHaveURL(/^http:\/\/127\.0\.0\.1:\d+\//);
    await expect(page.getByRole('heading', { name: /^Next \d/, level: 1 })).toBeVisible();

    const response = await page.request.get(new URL('/missing-renderer-file', page.url()).href);

    expect(response.status()).toBe(404);
});

import { expect, replaceSource, test } from '../../../../test/e2e/fixtures';

test.use({ exampleName: 'nuxt' });

test('develops a real Electron renderer and applies source updates', async ({ example }) => {
    await replaceSource(example.root, 'src/renderer/app.vue', '<template>', `<script setup>
onNuxtReady(() => document.documentElement.setAttribute('data-e2e-ready', 'true'));
</script>
<template>`);

    const page = await example.startDev();

    await expect(page.locator('html')).toHaveAttribute('data-e2e-ready', 'true');
    await expect(page.getByRole('heading', { name: /^Nuxt \d/, level: 1 })).toBeVisible();
    await replaceSource(example.root, 'src/renderer/app.vue', '<NuxtWelcome />', '<h1>Nuxt renderer updated</h1>');
    await expect(page.getByRole('heading', { name: 'Nuxt renderer updated' })).toBeVisible();
});

test('runs an unpacked production app without a development server', async ({ example }) => {
    const { electron, page } = await example.startBuilt();

    expect(await electron.evaluate(({ app }) => app.isPackaged)).toBe(true);
    await expect(page).toHaveURL(/^http:\/\/127\.0\.0\.1:\d+\//);
    await expect(page.getByRole('heading', { name: /^Nuxt \d/, level: 1 })).toBeVisible();

    const response = await page.request.get(new URL('/missing-renderer-file', page.url()).href);

    expect(response.status()).toBe(404);
});

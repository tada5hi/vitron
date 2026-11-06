import process from 'node:process';
import { defineConfig } from '@playwright/test';

export default defineConfig({
    testDir: './packages/vitron/test/e2e',
    fullyParallel: false,
    workers: 1,
    forbidOnly: !!process.env.CI,
    timeout: 180_000,
    globalTimeout: 20 * 60_000,
    expect: { timeout: 30_000 },
    reporter: [['list'], ['html', { open: 'never' }]],
});

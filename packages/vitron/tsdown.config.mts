import { defineConfig } from 'tsdown';

export default defineConfig([
    {
        entry: 'src/index.ts',
        format: ['esm'],
        outDir: 'dist',
        outExtensions: () => ({ js: '.mjs', dts: '.d.mts' }),
        clean: true,
        dts: true,
        sourcemap: true,
        tsconfig: 'tsconfig.build.json',
    },
    ...['main', 'preload', 'renderer'].map((name) => ({
        entry: `src/exports/${name}/index.ts`,
        format: ['esm'] as const,
        outDir: name,
        outExtensions: () => ({ js: '.mjs', dts: '.d.mts' }),
        clean: true,
        dts: true,
        tsconfig: 'tsconfig.build.json',
        copy: [{ from: 'assets/package.json', to: name }],
    })),
]);

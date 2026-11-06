import { defineConfig } from 'tsdown';

export default defineConfig([
    {
        entry: 'src/index.ts',
        format: ['cjs', 'esm'],
        outDir: 'dist',
        outExtensions: ({ format }) => ({ js: format === 'cjs' ? '.cjs' : '.mjs', dts: '.d.ts' }),
        dts: true,
        sourcemap: true,
        tsconfig: 'tsconfig.build.json',
    },
    ...['main', 'preload', 'renderer'].map((name) => ({
        entry: `src/exports/${name}/index.ts`,
        format: ['cjs', 'esm'] as const,
        outDir: name,
        outExtensions: ({ format }: { format: string }) => ({ js: format === 'cjs' ? '.cjs' : '.mjs' }),
        dts: true,
        tsconfig: 'tsconfig.build.json',
        copy: [{ from: 'assets/package.json', to: `${name}/package.json` }],
    })),
]);

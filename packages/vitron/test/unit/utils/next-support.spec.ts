import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { assertSupportedNext } from '../../../src/apps/renderer/next';
import { Framework, detectFrameworkSync } from '../../../src/utils';

function createConfig(framework: unknown) {
    return { get: (key: string) => (key === 'framework' ? framework : undefined) } as any;
}

describe('assertSupportedNext', () => {
    it('rejects Next below 14', () => {
        expect(() => assertSupportedNext(createConfig({ name: Framework.NEXT, version: '13.5.0' }))).toThrow('Next.js 14');
    });

    it.each(['14.0.0', '16.4.5'])('accepts Next %s', (version) => {
        expect(() => assertSupportedNext(createConfig({ name: Framework.NEXT, version }))).not.toThrow();
    });

    it('rejects a Next version that cannot be determined', () => {
        const run = () => assertSupportedNext(createConfig({ name: Framework.NEXT, version: 'latest' }));

        expect(run).toThrow(/install/i);
        expect(run).not.toThrow(/semver/i);
    });

    it('ignores other frameworks', () => {
        expect(() => assertSupportedNext(createConfig({ name: Framework.NUXT, version: '2.0.0' }))).not.toThrow();
        expect(() => assertSupportedNext(createConfig(undefined))).not.toThrow();
    });
});

describe('detectFrameworkSync', () => {
    function project(dependencies: Record<string, string>, installed?: string) {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vitron-next-'));

        fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'fixture', dependencies }));

        if (installed) {
            fs.mkdirSync(path.join(root, 'node_modules/next'), { recursive: true });
            fs.writeFileSync(path.join(root, 'node_modules/next/package.json'), JSON.stringify({ name: 'next', version: installed }));
        }

        return root;
    }

    it('prefers the installed Next version', () => {
        const root = project({ next: '~16.0.0' }, '16.0.5');

        try {
            expect(detectFrameworkSync(root)).toEqual({ name: 'next', version: '16.0.5' });
        } finally {
            fs.rmSync(root, { recursive: true, force: true });
        }
    });

    it('keeps the declared Next version when next is not installed', () => {
        const root = project({ next: '16.0.0' });

        try {
            expect(detectFrameworkSync(root)).toEqual({ name: 'next', version: '16.0.0' });
        } finally {
            fs.rmSync(root, { recursive: true, force: true });
        }
    });

    it('keeps the declared Nuxt version', () => {
        expect(detectFrameworkSync('test/data')).toEqual({ name: 'nuxt', version: '3.5.2' });
    });
});

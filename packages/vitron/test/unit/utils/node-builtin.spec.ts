import { expect, it } from 'vitest';
import { getNodeBuiltInModules } from '../../../src/utils/node-builtin';

it('externalizes both bare and node-protocol builtin imports', () => {
    expect(getNodeBuiltInModules()).toEqual(expect.arrayContaining(['process', 'node:process', 'fs/promises', 'node:fs/promises']));
});

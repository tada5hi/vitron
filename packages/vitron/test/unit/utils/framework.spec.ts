/*
 * Copyright (c) 2023.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { detectFrameworkSync } from '../../../src/utils';

describe('src/utils/framework', () => {
    it('should detect framework', () => {
        const framework = detectFrameworkSync('test/data');
        expect(framework).toBeDefined();
        expect(framework.name).toEqual('nuxt');
        expect(framework.version).toEqual('^3.5.2');
    });
});

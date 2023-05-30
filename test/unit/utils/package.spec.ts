/*
 * Copyright (c) 2023.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import {
    isPackageInfo,
    isPackageNameWithVersion,
    isValidPackageVersion,
    parsePackageNameWithVersion,
} from '../../../src/utils';

describe('src/utils/package', () => {
    it('should verify package version', () => {
        let version = '0.0.0';
        expect(isValidPackageVersion(version)).toBeTruthy();

        version = 'foo';
        expect(isValidPackageVersion(version)).toBeFalsy();

        version = '0.0.0-alpha.0';
        expect(isValidPackageVersion(version)).toBeTruthy();
    });

    it('should verify if is valid package name with version', () => {
        let name = 'nuxt@3.0.0';
        expect(isPackageNameWithVersion(name)).toBeTruthy();

        name = 'nuxt@foo';
        expect(isPackageNameWithVersion(name)).toBeFalsy();

        name = 'nuxt';
        expect(isPackageNameWithVersion(name)).toBeFalsy();
    });

    it('should verify if is valid package info', () => {
        let info : Record<string, any> = {
            name: 'nuxt',
            version: '3.0.0',
        };
        expect(isPackageInfo(info)).toBeTruthy();

        info = {
            name: 'nuxt',
        };
        expect(isPackageInfo(info)).toBeFalsy();
    });

    it('should parse package name with version', () => {
        const parsed = parsePackageNameWithVersion('nuxt@3.0.0');
        expect(parsed).toEqual({ name: 'nuxt', version: '3.0.0' });

        try {
            parsePackageNameWithVersion('nuxt');

            expect(true).toBeFalsy();
        } catch (e) {
            expect(true).toBeTruthy();
        }
    });
});

import path from 'path';
import fs from 'fs-extra';
import { Framework } from '../constants';

export function isValidFramework(input: unknown) : input is Framework {
    return typeof input === 'string' &&
        Object.values(Framework).indexOf(input as Framework) !== -1;
}

export function guessFramework(rootPath?: string) : `${Framework}` | undefined {
    if (typeof rootPath === 'undefined') {
        rootPath = process.cwd();
    } else if (!path.isAbsolute(rootPath)) {
        rootPath = path.join(process.cwd(), rootPath);
    }

    const packageJsonFilePath = path.join(rootPath, 'package.json');

    if (!fs.existsSync(packageJsonFilePath)) {
        return undefined;
    }

    // eslint-disable-next-line @typescript-eslint/no-var-requires,global-require,import/no-dynamic-require
    const { dependencies, devDependencies, peerDependencies } = require(packageJsonFilePath);

    const dependencyNames : string[] = Object.keys({
        ...(dependencies || {}),
        ...(devDependencies || {}),
        ...(peerDependencies || {}),
    });

    if (dependencyNames.indexOf(Framework.NUXT) !== -1) {
        return Framework.NUXT;
    }

    if (dependencyNames.indexOf(Framework.NEXT) !== -1) {
        return Framework.NEXT;
    }

    return undefined;
}

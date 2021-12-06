import path from 'path';
import fs from 'fs-extra';
import { Config, Framework } from '../type';

export function detectFramework(config: Config) : Framework | undefined {
    if (config.framework) {
        return config.framework;
    }

    const packageJsonFilePath = path.join(config.rootPath, 'package.json');

    if (!fs.existsSync(packageJsonFilePath)) {
        return undefined;
    }

    // eslint-disable-next-line @typescript-eslint/no-var-requires,global-require,import/no-dynamic-require
    const { dependencies, devDependencies } = require(packageJsonFilePath);

    const dependencyNames : string[] = Object.keys({
        ...(dependencies || {}),
        ...(devDependencies || {}),
    });

    if (dependencyNames.indexOf('nuxt') !== -1) {
        return 'nuxt';
    }

    if (dependencies.indexOf('next') !== -1) {
        return 'next';
    }

    return undefined;
}

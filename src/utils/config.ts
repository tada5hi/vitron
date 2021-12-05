import path from 'path';
import fs from 'fs-extra';
import { Config } from '../type';
import { detectFramework } from './detect-framework';

export function getElectronAdapterConfig(directoryPath: string) : Config {
    const filePath : string = path.join(directoryPath, 'electron-adapter.config.js');

    if (!fs.existsSync(filePath)) {
        process.exit(1); // todo: remove after debug
        return extendElectronAdapterConfig({}, directoryPath);
    }

    // todo: validation required
    // eslint-disable-next-line global-require,import/no-dynamic-require,@typescript-eslint/no-var-requires
    const config : Config = require(filePath);

    return extendElectronAdapterConfig(config, directoryPath);
}

function extendElectronAdapterConfig(config: Config, directoryPath: string) : Config {
    if (config.rootPath) {
        if (!path.isAbsolute(config.rootPath)) {
            config.rootPath = path.join(directoryPath, config.rootPath);
        }
    } else {
        config.rootPath = directoryPath;
    }

    if (!config.rendererDirectory) {
        config.rendererDirectory = 'renderer';
    }

    if (!config.mainDirectory) {
        config.mainDirectory = 'main';
    }

    if (!config.framework) {
        config.framework = detectFramework(config);
    }

    return config;
}

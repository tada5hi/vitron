import fs from 'fs-extra';
import path from 'path';
import { Config } from '../type';

export function clearRendererBuilds(config: Config) {
    const rendererFiles : string[] = [];

    if (config.framework) {
        switch (config.framework) {
            case 'nuxt':
                rendererFiles.push(...[
                    '.nuxt',
                    'dist',
                ]);
                break;
            case 'next':
                rendererFiles.push(...[
                    '.next',
                    'dist',
                ]);
                break;
        }
    }

    const rendererDirectoryPath = path.join(config.rootPath, config.rendererDirectory);

    const directoryPaths : string[] = [
        ...(
            config.rendererBuildPaths ?
                config.rendererBuildPaths.map((directoryPath) => (
                    path.isAbsolute(directoryPath) ?
                        directoryPath :
                        path.join(config.rootPath, directoryPath)
                )) :
                []
        ),
        ...rendererFiles.map((rendererFile) => path.join(rendererDirectoryPath, rendererFile)),
    ];

    if (directoryPaths.length > 0) {
        directoryPaths
            .map((directoryPath) => fs.removeSync(directoryPath));
    }
}

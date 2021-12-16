/*
 * Copyright (c) 2021.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import path from 'path';
import fs from 'fs-extra';
import { render } from 'mustache';

export async function copyTemplateFile(
    templateFilePath: string,
    destinationFilePath: string,
    context: Record<string, any>,
) : Promise<void> {
    templateFilePath = path.isAbsolute(templateFilePath) ?
        templateFilePath :
        path.join(__dirname, '..', '..', 'assets', 'templates', templateFilePath);

    const destinationDirectoryPath = path.dirname(destinationFilePath);

    try {
        await fs.promises.access(destinationDirectoryPath);
    } catch (e) {
        await fs.promises.mkdir(destinationDirectoryPath, { recursive: true });
    }

    try {
        await fs.promises.access(destinationFilePath, fs.constants.F_OK | fs.constants.R_OK);
    } catch (e) {
        let mainIndexTpl = await fs.promises.readFile(
            path.join(templateFilePath),
            { encoding: 'utf-8' },
        );

        mainIndexTpl = render(mainIndexTpl, context);

        await fs.promises.writeFile(
            destinationFilePath,
            mainIndexTpl,
            { encoding: 'utf-8' },
        );
    }
}

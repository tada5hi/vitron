/*
 * Copyright (c) 2023.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

export type ServeOptions = {
    /**
     * Directory where the render files are located.
     *
     * default: .vitron/renderer
     */
    directory?: string,

    /**
     * The port value will be ignored in production,
     * but should be provided in development.
     */
    port?: number | string
};

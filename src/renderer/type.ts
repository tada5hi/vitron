/*
 * Copyright (c) 2021.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import WebpackDevServer from 'webpack-dev-server';
import { ChildProcess } from 'child_process';

export type RendererWebpackDevServerInstance = {
    type: 'webpackDevServer',
    value: WebpackDevServer
};

export type RendererProcessInstance = {
    type: 'childProcess',
    value: ChildProcess
};

export type RendererInstance = RendererWebpackDevServerInstance |
RendererProcessInstance;

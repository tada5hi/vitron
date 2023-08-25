/*
 * Copyright (c) 2023.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

export function getElectronMainDependencies() : string[] {
    return [
        'app',
        'auto-updater',
        'browser-window',
        'content-tracing',
        'dialog',
        'global-shortcut',
        'ipc-main',
        'menu',
        'menu-item',
        'power-monitor',
        'power-save-blocker',
        'protocol',
        'session',
        'tray',
        'web-contents',
    ];
}

export function getElectronRendererDependencies() : string[] {
    return [
        'desktop-capturer',
        'ipc-renderer',
        'remote',
        'web-frame',
    ];
}

export function getElectronDependencies(): string[] {
    return [
        'clipboard',
        'crash-reporter',
        'electron',
        'ipc',
        'native-image',
        'original-fs',
        'screen',
        'shell',
    ];
}

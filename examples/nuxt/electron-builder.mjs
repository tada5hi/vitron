import electron from 'electron/package.json' with { type: 'json' };

export default {
    extends: './electron-builder.yml',
    electronVersion: electron.version,
};

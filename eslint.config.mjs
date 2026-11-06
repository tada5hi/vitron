import config from '@tada5hi/eslint-config';

export default config(
    {},
    // Keep emitted runtime code compatible with the published Node 20.19 floor.
    {
        rules: {
            'unicorn/prefer-error-is-error': 'off',
            'unicorn/prefer-promise-try': 'off',
            'unicorn/prefer-uint8array-base64': 'off',
            'unicorn/prefer-uint8array-hex': 'off',
            'unicorn/prefer-regexp-escape': 'off',
            'unicorn/prefer-promise-with-resolvers': 'off',
        }, 
    },
    { ignores: ['**/dist/**', '**/node_modules/**', '**/coverage/**', '**/writable/**', '**/.nuxt/**', '**/.output/**', 'packages/vitron/assets/**', 'packages/vitron/main/**', 'packages/vitron/preload/**', 'packages/vitron/renderer/**'] },
);

import { defineConfig } from 'vitest/config';

export default defineConfig({
    'test': {
        'include': [
            'test/unit/**/*.{spec,test}.{ts,js}',
        ],
        'globals': true,
        'environment': 'node',
        'coverage': {
            'provider': 'v8',
            'include': [
                'src/**/*.{ts,tsx,js,jsx}',
            ],
            'exclude': [
                'src/**/*.d.ts',
            ],
            'reportsDirectory': 'coverage',
            'thresholds': {
                'branches': 80,
                'functions': 80,
                'lines': 80,
                'statements': 80,
            },
        },
    },
});

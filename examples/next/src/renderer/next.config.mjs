import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const next = require('next/package.json');

const sources = path.dirname(fileURLToPath(import.meta.url));
const installed = path.dirname(require.resolve('next/package.json'));

// Turbopack only compiles files below its root, so the root must contain both
// these sources and the (possibly symlinked) install of next.
function commonRoot(a, b) {
    const left = a.split(path.sep);
    const right = b.split(path.sep);
    const shared = [];

    for (let i = 0; i < left.length && left[i] === right[i]; i++) {
        shared.push(left[i]);
    }

    return shared.join(path.sep) || path.sep;
}

export default {
    output: 'export',
    distDir: 'dist',
    env: { NEXT_VERSION: next.version },
    // Next infers this root from the nearest lockfile, which misses an install of next outside this tree (workspaces, symlinks).
    turbopack: { root: commonRoot(sources, installed) },
};

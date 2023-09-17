# Vitron 🖥️

[![npm version](https://badge.fury.io/js/vitron.svg)](https://badge.fury.io/js/vitron)
[![CI](https://github.com/tada5hi/vitron/actions/workflows/main.yml/badge.svg)](https://github.com/tada5hi/vitron/actions/workflows/main.yml)
[![Known Vulnerabilities](https://snyk.io/test/github/Tada5hi/vitron/badge.svg?targetFile=package.json)](https://snyk.io/test/github/Tada5hi/vitron?targetFile=package.json)
[![semantic-release: angular](https://img.shields.io/badge/semantic--release-angular-e10079?logo=semantic-release)](https://github.com/semantic-release/semantic-release)

A library to build and develop desktop apps with **vite** and **electron** 🔥.

## Features
- Hot Module Replacement

**Table of Contents**

- [Installation](#installation)
- [Setup](#setup)
  - [Frameworks](#frameworks)
- [Usage](#usage)
- [Utilities](#utilities)
- [License](#license)

## Installation

```bash
npm install --save vitron
```

## Setup

To init a project folder with the necessary files, run the command:

```bash
npx vitron@latest init
```

This will create the following files/directories, if they do not already exist:

- src
    - main
        - index.ts
    - preload
        - index.ts
    - renderer
        - main.ts
        - index.html
- .electron-builder.yml

After the directory structure has been created, 
the dependencies must be installed using a package manager like npm, pnpm, .... In the following example, npm is used:

```bash
npm install
```

The default location of the `main`, `preload` and `renderer` directory can
be changed with a configuration file in the root directory  of the project.

Therefore, create a `vitron.config.js` file in the root folder with the following content:

```javascript
module.exports = {
    mainDirectory: 'src/main',
    preloadDirectory: 'src/preload',
    rendererDirectory: 'src/renderer',
}
```

### Frameworks

Various frontend frameworks, such as `Nuxt.js` and `Next.js`, can be used out of the box and do not require any special configuration 🎉. 
The framework files only need to be placed in the `rendererDirectory`.

## Usage

In a project where Vitron is installed, the vitron binary can be used as npm script.
Alternatively run it directly with `npx vitron`. 
Here are the default npm scripts in a scaffolded Vitron project:

The best way to use the following commands, is by creating shortcuts in the `package.json` file.

```json
{
    "scripts": {
        "dev": "vitron dev",
        "build": "vitron build"
    }
}
```

## Utilities

Vitron provides different utilities for the main, preload and renderer code.

### Main
For the main code, the import path `vitron/main` is provided.

**`serve`**

Serve the renderer app (ink. static assets) for production and development.

```typescript
import { serve } from 'vitron/main';
import { BrowserWindow } from 'electron';

const mainWindow = new BrowserWindow({
    /* ... */
});

await serve(mainWindow, {
    directory: path.join(`${__dirname}/../renderer/`),
    port: process.env.PORT,
});
```

To see an exemplary use, the following example can be used as a basis
**examples/vanilla/src/main/index.ts**.

### Preload
For the preload code, the import path `vitron/preload` is provided.

**`provide`**

Simple abstraction to expose an API to the renderer process.

```typescript
import { provide } from 'vitron/preload';

provide('foo', 'bar');
```

To see an exemplary use, the following example can be used as a basis
**examples/vanilla/src/preload/index.ts**.

## Renderer
For the preload code, the import path `vitron/renderer` is provided.

**`inject`**

Simple abstraction to inject an API from the preload script.

```typescript
import { inject } from 'vitron/renderer';

const foo = inject<string>('foo');
console.log(foo);
// bar
```

To see an exemplary use, the following example can be used as a basis
**examples/vanilla/src/renderer/index.ts**.

## License

Made with 💚

Published under [MIT License](./LICENSE).

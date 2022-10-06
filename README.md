# Electron Adapter 🛠

[![npm version](https://badge.fury.io/js/electron-adapter.svg)](https://badge.fury.io/js/electron-adapter)
[![CI](https://github.com/tada5hi/electron-adapter/actions/workflows/main.yml/badge.svg)](https://github.com/tada5hi/electron-adapter/actions/workflows/main.yml)
[![Known Vulnerabilities](https://snyk.io/test/github/Tada5hi/electron-adapter/badge.svg?targetFile=package.json)](https://snyk.io/test/github/Tada5hi/electron-adapter?targetFile=package.json)
[![semantic-release: angular](https://img.shields.io/badge/semantic--release-angular-e10079?logo=semantic-release)](https://github.com/semantic-release/semantic-release)

This is a library to build platform (win, linux, mac) executables for a bundled static web application.
It is also possible to debug the application with HMR.

**Table of Contents**

- [Installation](#installation)
- [Usage](#usage)
  - [Init](#init)
  - [Build](#build)
  - [Dev](#dev)
- [License](#license)

## Installation

```bash
npm install --save electron-adapter
```

---
**Important NOTE**

The `README.md` file is under construction ☂ at the moment.
So please stay patient or contribute to it, till it covers all parts ⭐.

---

## Usage

The best way to use the following commands, is by creating shortcuts in the `package.json` file.

```json
{
    "scripts": {
        "init": "electron-adapter init",
        "dev": "electron-adapter dev",
        "build": "electron-adapter build"
    }
}
```

### Init

To init the project folder with the necessary files, run the command:

```bash
npm run init
```

**or**

```bash
electron-adapter init
```

This will create the following files/directories, if they do not already exist:

**Directories**
- entrypoint
- src

**Files**
- .electron-builder.yml
- tsconfig.json
- entrypoint/index.ts
- src/index.js
- src/index.html

The `entrypoint` & `src` path and other specifications, 
can be changed with a configuration file in the root directory  of the project.

Therefore, create a `.electron-adapter.yml` file in the root folder with the following content:

```javascript
module.exports = {
    port: 9000,
    
    // framework: 'nuxt' | 'next',
    
    // rootPath: '',
    
    // buildDirectory: 'dist',
    
    entrypointDirectory: 'entrypoint',
    // entrypointWebpack: undefined, 
    
    rendererDirectory: 'src',
    // rendererWebpack: undefined, 
}
```

### Dev

To run the application in development mode, with Hot Module Replacement (HMR).

```bash
npm run dev
```

**or**

```bash
electron-adapter dev
```

### Build

To build the application for an operating system, run the following command.

```bash
npm run build
```

**or**

```bash
electron-adapter build
```

## License

Made with 💚

Published under [MIT License](./LICENSE).

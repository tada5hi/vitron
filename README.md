# Vitron 🌰

[![npm version](https://badge.fury.io/js/vitron.svg)](https://badge.fury.io/js/vitron)
[![CI](https://github.com/tada5hi/vitron/actions/workflows/main.yml/badge.svg)](https://github.com/tada5hi/vitron/actions/workflows/main.yml)
[![Known Vulnerabilities](https://snyk.io/test/github/Tada5hi/vitron/badge.svg?targetFile=package.json)](https://snyk.io/test/github/Tada5hi/vitron?targetFile=package.json)
[![semantic-release: angular](https://img.shields.io/badge/semantic--release-angular-e10079?logo=semantic-release)](https://github.com/semantic-release/semantic-release)

This is a library to build beautiful (win, linux, mac) desktop apps, 
for any static web application.

**Table of Contents**

- [Installation](#installation)
- [Usage](#usage)
  - [Init](#init)
  - [Build](#build)
  - [Dev](#dev)
- [License](#license)

## Installation

```bash
npm install --save vitron
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
        "init": "vitron init",
        "dev": "vitron dev",
        "build": "vitron build"
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
vitron init
```

This will create the following files/directories, if they do not already exist:

- src
  - entrypoint
    - index.ts
  - renderer
    - index.js
    - index.html
- .electron-builder.yml
- tsconfig.json

The default location of the `entrypoint` and `renderer` directory can 
be changed with a configuration file in the root directory  of the project.

Therefore, create a `.vitron.yml` file in the root folder with the following content:

```javascript
module.exports = {
    port: 9000,
    
    entrypointDirectory: 'src/entrypoint',
    
    rendererDirectory: 'src/renderer',
}
```

### Dev

To run the application in development mode, with Hot Module Replacement (HMR).

```bash
npm run dev
```

**or**

```bash
vitron dev
```

### Build

To build the application for an operating system, run the following command.

```bash
npm run build
```

**or**

```bash
vitron build
```

## License

Made with 💚

Published under [MIT License](./LICENSE).

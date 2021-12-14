# Electron Adapter 🛠

[![npm version](https://badge.fury.io/js/electron-adapter.svg)](https://badge.fury.io/js/electron-adapter)
[![CI](https://github.com/tada5hi/electron-adapter/actions/workflows/main.yml/badge.svg)](https://github.com/tada5hi/electron-adapter/actions/workflows/main.yml)

This is a library to build platform (win, linux, mac) executables for a bundled static web application.
It is also possible to debug the application with HMR.

**Table of Contents**

- [Installation](#installation)
- [Usage](#usage)
  - [Init](#init)
  - [Build](#build)
  - [Dev](#dev)

## Installation

```bash
npm install --save electron-adapter
```

## Usage
### Init

To init the project folder with the necessary files, run the command:

```bash
electron-adapter init
```

This will create the following files/directories, if they do not already exist:

**Directories**
- main
- renderer

**Files**
- main/index.ts
- .electron-builder.yml
- tsconfig.json

The `main` & `renderer` path and other specifications, 
can be changed with a configuration file in the root directory  of the project.

Therefore, create a `.electron-adapter.yml` file in the root folder with the following content:

```javascript
module.exports = {
    port: 9000,
    
    // framework: 'nuxt' | 'next',
    
    // rootPath: '',
    
    // buildDirectory: 'dist',
    // buildTempDirectory: '.electron-adapter',
    mainDirectory: 'main',

    rendererDirectory: 'renderer'
}
```

---
**Important NOTE**

The `Readme.md` is under construction ☂ at the moment. So please stay patient, till it is available ⭐.

---

### Dev

coming soon...

### Build

coming soon...

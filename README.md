# Vitron 🍑

[![npm version](https://badge.fury.io/js/vitron.svg)](https://badge.fury.io/js/vitron)
[![CI](https://github.com/tada5hi/vitron/actions/workflows/main.yml/badge.svg)](https://github.com/tada5hi/vitron/actions/workflows/main.yml)
[![Known Vulnerabilities](https://snyk.io/test/github/Tada5hi/vitron/badge.svg?targetFile=package.json)](https://snyk.io/test/github/Tada5hi/vitron?targetFile=package.json)
[![semantic-release: angular](https://img.shields.io/badge/semantic--release-angular-e10079?logo=semantic-release)](https://github.com/semantic-release/semantic-release)

This is a library to build beautiful (win, linux, mac) desktop apps
for modern web projects with **vite** and **electron**.

**Table of Contents**

- [Installation](#installation)
- [Setup](#setup)
- [Usage](#usage)
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

## Setup

To init a project folder with the necessary files, run the command:

```bash
npx vitron@latest init
```

This will create the following files/directories, if they do not already exist:

- src
    - entrypoint
        - index.ts
    - renderer
        - index.js
        - index.html
- .electron-builder.yml

The default location of the `entrypoint` and `renderer` directory can
be changed with a configuration file in the root directory  of the project.

Therefore, create a `vitron.config.js` file in the root folder with the following content:

```javascript
module.exports = {
    port: 9000,
    
    entrypointDirectory: 'src/entrypoint',
    
    rendererDirectory: 'src/renderer',
}
```

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

## License

Made with 💚

Published under [MIT License](./LICENSE).

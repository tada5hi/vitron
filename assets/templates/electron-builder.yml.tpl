appId: com.example.electron
productName: My Electron App with Electron-Adapter
copyright: Copyright © 2021 tada5hi
directories:
    output: dist
    buildResources: resources
artifactName: app-${version}.${ext}
extraMetadata:
    main: {{{entrypointDistDirectory}}}/index.js
files:
    - from: .
      filter:
          - package.json
          - {{{entrypointDistDirectory}}}/**/*
publish: null
win:
    publisherName: tada5hi
    target: nsis
nsis:
    differentialPackage: true
linux:
    target: deb
mac:
    target: dmg

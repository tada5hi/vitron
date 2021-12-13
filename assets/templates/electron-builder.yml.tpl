appId: com.example.electron
productName: My Electron App with Electron-Adapter
copyright: Copyright © 2021 tada5hi
directories:
    output: {{buildDirectory}}
    buildResources: resources
extraMetadata:
    main: {{buildTempDirectory}}/index.js
files:
    - from: .
      filter:
          - package.json
          - {{buildTempDirectory}}/**/*
publish: null

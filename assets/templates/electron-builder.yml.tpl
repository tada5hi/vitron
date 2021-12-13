appId: com.example.electron
productName: My Electron App with Electron-Adapter
copyright: Copyright © 2021 tada5hi
directories:
    output: dist
    buildResources: resources
extraMetadata:
    main: {{buildDirectory}}/index.js
files:
    - from: .
      filter:
          - package.json
          - {{buildDirectory}}/**/*
publish: null

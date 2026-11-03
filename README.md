# Portal UI Library

This library helps you to set up the front end application using `@openmfp/portal-ui-lib` by providing the set of required implementations
in the scope of the Platform Mesh functionalities.

<!-- CI trigger -->

[![OpenSSF Scorecard](https://api.scorecard.dev/projects/github.com/platform-mesh/portal-ui-lib/badge)](https://scorecard.dev/viewer/?uri=github.com/platform-mesh/portal-ui-lib)
![Build Status](https://github.com/platform-mesh/portal-ui-lib/actions/workflows/ci.yml/badge.svg)

## Getting Started

### Build

Run `npm run build` to build the project. The build artifacts will be stored in the `dist/` directory.

### Running unit tests

Run `npm run test:lib` or `npm run test:wc` to execute unit tests with Vitest and coverage. `npm run test` runs both projects followed by the Playwright integration tests.

## Generic UI Feature

There is a possibility to reuse generic ui components in the form of web components, without building the micro frontend.
Please follow our [generic ui guide](./docs/readme-generic-ui.md) for this task.

### Angular Configuration

Configure the angular build process (in the `angular.json` file) to include the content of the assets
from `@platform-mesh/portal-ui-lib` library into the project assets, as shown below:

```
{
  // ... the rest of the angular.json configuration
  "assets": [
    {
      "glob": "**",
      "input": "node_modules/@platform-mesh/portal-ui-lib/assets/",
      "output": "/assets/"
    },
  ]
    // ... other configured assets
}
```

## Requirements

The portal requires the installation of node.js and npm.
Check out the [package.json](package.json) for the required node version and dependencies.

## Contributing

Please refer to the [CONTRIBUTING.md](CONTRIBUTING.md) file in this repository for instructions on how to contribute to platform-mesh.

## Code of Conduct

Please refer to our [Code of Conduct](https://github.com/platform-mesh/.github/blob/main/CODE_OF_CONDUCT.md) for information on the expected conduct for contributing to Platform Mesh.

<p align="center"><img alt="Bundesministerium für Wirtschaft und Energie (BMWE)-EU funding logo" src="https://apeirora.eu/assets/img/BMWK-EU.png" width="400"/></p>

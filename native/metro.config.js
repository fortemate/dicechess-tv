// Metro configuration for the Vega package.
//
// The one thing this must add to the default: `watchFolders`. The screens here
// import the shared core from `../src/core`, and the core imports the engine
// from the repository root's `node_modules`. Both live outside this directory,
// and Metro will not follow a path it is not watching — without this the bundle
// fails to resolve `../../src/core/game` and the app never starts.
const path = require('path');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

const repositoryRoot = path.resolve(__dirname, '..');

const config = {
  watchFolders: [repositoryRoot],
  resolver: {
    nodeModulesPaths: [
      path.resolve(__dirname, 'node_modules'),
      path.resolve(repositoryRoot, 'node_modules'),
    ],
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);

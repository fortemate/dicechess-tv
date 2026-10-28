const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');
const config = getDefaultConfig(__dirname);
config.watchFolders = [path.resolve(__dirname, '..')];
// Shared source must use this app's React, never the sibling Vega renderer.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const appRuntime = /^(react|react-native)(\/|$)/.test(moduleName);
  return context.resolveRequest(
    appRuntime
      ? { ...context, originModulePath: path.join(__dirname, 'index.js') }
      : context,
    moduleName,
    platform,
  );
};
config.resolver.nodeModulesPaths = [
  path.resolve(__dirname, 'node_modules'),
  path.resolve(__dirname, '../node_modules'),
];
config.resolver.assetExts.push('engine');
module.exports = config;

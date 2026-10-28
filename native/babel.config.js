module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    // Shared artwork uses the standard module name. Both Metro and the Vega
    // package builder run Babel, so this mapping applies to both bundles.
    [
      'module-resolver',
      { alias: { '^react-native-svg$': '@amazon-devices/react-native-svg' } },
    ],
    '@amazon-devices/react-native-worklets/plugin',
  ],
};

---
title: Build and run
description: How to set up prerequisites, build package binaries, install on the Vega Virtual Device or Fire TV Stick, and troubleshoot common issues.
sidebar:
  order: 1
---

Dice Chess TV is built with Amazon's Vega SDK and React Native for Vega. This guide covers how to set up the toolchain, compile package binaries, install them on emulators or physical hardware, and resolve common build issues.

## Prerequisites

1. **Node.js and the hook tools:** [mise](https://mise.jdx.dev) installs the versions `mise.toml` pins: Node 26.8.2, and lefthook, betterleaks and actionlint for the Git hooks. Without mise, use Node 26 (`>=26.8.2 <27`); check with `node -v`.
2. **Amazon Vega SDK 0.24:**
   - Download and install the Vega SDK 0.24 from the [Amazon Developer Portal](https://developer.amazon.com/docs/vega/0.24/vega-get-started).
   - Ensure the SDK's `bin/` directory is in your shell `PATH` so that `vega` commands are available.
   - Note: The Vega SDK is distributed under Amazon's Program Materials License Agreement and cannot be committed to this repository.
3. **Execution Target:**
   - **Vega Virtual Device (Emulator):** Configured for 1920x1080 (SDK 0.24.12112).
   - **Physical Fire TV Stick:** in Developer Mode, connected to the Vega CLI.

## Building the Application

The repository holds four npm packages: the root (the shared core in `src/core/`, its tests and scripts), `native/` (the Vega application), `web/` (the browser test bench) and `site/` (this site). With mise:

```bash
# 1. Node and the hook tools
mise install

# 2. npm ci at the root, in native/ and in web/, and the Git hooks
mise run setup

# 3. Build the packages, numbered as the latest beta or release
mise run build
```

`mise run build` takes the highest build number among the beta and release tags, builds with it, and then checks that the licence notices name every npm package the Vega build bundled ([Credits and licences](/contribute/credits/#open-source-software-in-the-app)). Without mise, `npm ci`, `npm ci --prefix native` and `npm ci --prefix web` install the same packages, and `npm run build --prefix native` builds them, but with build number 0 and without that check. `mise tasks` lists every task, among them `mise run check`, which runs the checks CI runs apart from coverage and the site. The site is installed on its own, with `npm ci --prefix site` ([site/README.md](https://github.com/fortemate/dicechess-tv/blob/main/site/README.md)).

### Generated Package Binaries

The build generates three architecture-specific `.vpkg` packages under `native/build/`:

| Package Path                                                    | Target Hardware / Architecture                                                                 |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `native/build/aarch64-release/dicechess-tv-native_aarch64.vpkg` | **Vega Virtual Device** on Apple silicon Macs (ARM64)                                          |
| `native/build/x86_64-release/dicechess-tv-native_x86_64.vpkg`   | **Vega Virtual Device** on Intel Macs or Linux (x86_64)                                        |
| `native/build/armv7-release/dicechess-tv-native_armv7.vpkg`     | **Physical Fire TV Sticks** running Vega OS (32-bit `armv7`: 4K Select AFTCA002 & HD AFTCL001) |

## Installing and Launching

### On the Vega Virtual Device

To run the app on an Apple silicon Mac using the virtual device:

```bash
# Start the virtual device emulator
vega virtual-device start

# Install the package built for the device's processor, and launch it
npm run device --prefix native -- --launch
```

`mise run device:start` starts the Virtual Device, and `mise run device:run` builds, installs and launches in one step.

### On a Physical Fire TV Stick

Connect your Fire TV Stick over the local network with the Vega CLI:

```bash
# Discover connected target devices
vega device list

# Install the armv7 package, which the script picks for a Stick, and launch it
npm run device --prefix native -- --device <DeviceId> --launch
```

## Security Audit & Tooling Advisories

On 9 October 2026, `npm audit --omit=dev` inside `native/` listed 49 vulnerable packages (1 critical, 34 high, 14 moderate), and `npm audit` 55. Their advisories are in `ajv`, `braces`, `fast-xml-parser`, `lodash`, `minimatch`, `shell-quote` and `sprintf-js`, and among the development dependencies also `toml` and `uuid`. Every other package on the list depends on one of them.

### Why Zero Vulnerable Code Ships to Devices

None of these packages reach the device package:

- The compiled package bundle contains our JavaScript/Hermes bytecode, artwork, sound assets, `libreact-native-mmkv-kepler.so`, and manifest metadata.
- The source map of that day's release build lists 172 modules in the application bundle, and none of them comes from a package with an advisory. React Native and system modules are deployed directly by the Vega OS platform runtime on the device.
- The packages with advisories belong to developer tooling (e.g. `@microsoft/api-extractor`, `jscodeshift`, manifest generators, and CLI formatters) running on the local host machine during build time. Three Amazon packages in the bundle, `react-native-kepler`, `react-native-mmkv` and `keplerscript-turbomodule-api`, are listed only because they depend on such tools.

:::caution[Do Not Run npm audit fix --force]
Never execute `npm audit fix --force` in `native/`. The automated npm solver attempts to resolve dependencies by downgrading `@amazon-devices/react-native-kepler` to `2.1.0` (the older SDK 0.23 line). SDK 0.23 suffers from severe WebView crashes that forced the move to native React Native on SDK 0.24.
:::

## Metro Configuration Details

The React Native packager configuration in `native/metro.config.js` differs from Amazon's default template.

The screens import the shared core from `../src/core/`, and the core imports the rules engine from the repository root's `node_modules/`. Both live outside `native/`, so Metro must watch the repository root and look up packages in both `node_modules` directories:

```javascript
// native/metro.config.js
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
```

Without `watchFolders`, Metro fails with `Unable to resolve module ../../src/core/game`.

Without `resolver.nodeModulesPaths`, it fails with `Unable to resolve module @babel/runtime/helpers/interopRequireDefault` instead. Babel adds imports of its runtime helpers to the core's files as it compiles them, and `@babel/runtime` is installed only in `native/node_modules`. Metro looks for a package in the `node_modules` directories above the importing file, and `native/node_modules` is not above `src/core/`.

## Troubleshooting

### "Package version decrease" Error

A device refuses a build numbered lower than the one installed, such as a beta or a release from GitHub Releases or the Amazon Appstore. `mise run build` and `mise run device:run` number a local build as the latest beta or release, which they read from the tags, so it installs over that build and keeps its saved game. A beta tag ends in its build number (`v0.1.0-beta.24`) and a release tag carries it after a `+` (`v1.0.0+26`); see "Releases" in [CONTRIBUTING.md](https://github.com/fortemate/dicechess-tv/blob/main/CONTRIBUTING.md#releases). A direct `npm run build --prefix native` builds with number 0: give it the latest number, 26 since 1.0.0, or a higher one.

```bash
npm run build --prefix native -- --build-number 26
```

`BUILD_NUMBER=26 mise run device:run` sets the number by hand. Removing the app (`vega device uninstall-app -d VirtualDevice -a com.fortemate.dicechesstv.main`) also works, but it deletes the saved game, the results and the settings.

### The app stops at start with `ModuleNotFoundError` in `getMMKVTurboModule`

`vega device install-app` installs a package built for another processor without a word, and the app then dies at start: each package carries the MMKV native library for its own processor only, so react-native-mmkv finds no TurboModule ([FL-30](/friction-log/#fl-30)). `npm run device --prefix native`, with `-- --device <DeviceId>` for a Stick, asks the device what it runs on and installs the package built for it: aarch64 for the Virtual Device on an Apple silicon Mac, x86_64 for the Virtual Device elsewhere, armv7 for a Fire TV Stick. `mise run device:install` does the same for the Virtual Device.

### The Vega SDK stops working after a macOS 27 upgrade

Upgrading a Mac from macOS 26 to macOS 27 removes Rosetta, and several Vega SDK components depend on it ([Amazon's bulletin](https://community.amazondeveloper.com/t/developer-bulletin-issues-with-vega-devkit-after-mac-os-27-upgrade/29216)). A tool that needs it fails with "Bad CPU type in executable". Reinstall Rosetta:

```bash
softwareupdate --install-rosetta --agree-to-license
```

### Missing Audio Output

If no sound is heard on the virtual device, verify that the required audio services are declared in `native/manifest.toml`. Undeclared audio service connections fail silently with log warnings. See [Building on Vega](/technology/vega/#audio-subsystem--manifest-permissions).

### `buildinfo.json`

The SDK build tool writes `buildinfo.json` next to `manifest.toml` on every build. It contains local absolute machine paths and is ignored by git (`.gitignore`).

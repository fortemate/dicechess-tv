# Vega SDK experiment — 21 September 2026

## Result

The SDK installation and ARM64 release-package build work. A Hello World app was installed and appeared in the running-app list. A WebView shell containing the browser probe was built and installed, but crashed. Replacing its entry page with plain HTML without JavaScript also produced a lifecycle crash record. The browser probe remains the only validated gameplay environment.

This is a local experiment outside the repository, under `~/vega/samples`. Generated SDK templates, crash reports, dependency trees and binaries are not committed. The WebView sample currently contains the HTML control; its game entry page was saved as `game-index.html.saved`. Its other bundled game assets are unused by the control page.

## Environment and installation

- Host: Apple Silicon macOS; Node 26.8.2.
- Vega CLI: **1.3.4**.
- Active SDK: **0.24.12044**, main channel.
- SDK-provided Vega Virtual Device, 1920 × 1080, ARM64.
- React Native: **0.83.0**; React **19.2.0**.
- `@amazon-devices/react-native-kepler`: **4.0.1+rn0.83.0**.
- `@amazon-devices/webview`: **4.0.2**.
- After installation and sample builds, the host reported about 14 GiB free; another full SDK installation needs a fresh space check.
- Rosetta was already installed. Missing Homebrew prerequisites were installed.
- The official installer created `~/vega` and added its environment source to existing shell profiles. The optional VS Code extension was skipped.
- The SDK installer reports telemetry enabled by default; see [Amazon telemetry configuration](https://developer.amazon.com/docs/vega/0.24/telemetry).
- The official template dependency installs reported 27 npm audit findings (14 moderate, 13 high). No automatic dependency upgrades were applied; these findings require review before a distributable shell is adopted.

Follow the [official installation instructions](https://developer.amazon.com/docs/vega/0.24/install-vega-sdk), then verify:

```bash
source ~/vega/env
vega --version
vega sdk list-installed
vega virtual-device start --display-res=1920,1080
vega virtual-device status
```

The first CLI launch reported ready, but a later status check showed no running process. A repeated launch in a persistent terminal session remained running. The cause of that first exit was not established. In automation, keep the owning terminal session alive and verify status after the launch command returns.

## Hello World

```bash
vega project generate --template helloWorld --name VegaHelloProbe \
  --packageId com.fortemate.vegahelloprobe \
  --outputDir ~/vega/samples/VegaHelloProbe
cd ~/vega/samples/VegaHelloProbe
vega exec npm install
vega exec npx react-native build-vega --build-type Release \
  --target aarch64 --max-workers 2
```

Use the actual VPKG path printed by the build with `vega run-app <path> com.fortemate.vegahelloprobe.main -d VirtualDevice`. Build and manifest validation passed. Installation and launch completed, and `vega device running-apps` listed the component. It was subsequently terminated to isolate the WebView run. Successful visual rendering was not verified.

## WebView and HTML control

1. Generate `vegaWebview` as `DiceChessWebProbe`, package ID `com.fortemate.dicechesswebprobe`, under `~/vega/samples`.
2. Install template dependencies with `vega exec npm install`.
3. Copy the browser production `dist` contents into the shell's `assets` directory. Keep the template URI `file:///pkg/assets/index.html`; enable `allowFileAccess` for this game experiment.
4. Build a Release/aarch64 package as above. Inspect the staged package: HTML, CSS, main module and Worker were all present. Manifest validation and packaging passed.
5. Install with `vega device install-app -d emulator-5554 -p <vpkg>` and launch with `vega device launch-app -d emulator-5554 -a com.fortemate.dicechesswebprobe.main`.
6. Check `vega device running-apps` and `vega exec vda -s emulator-5554 shell vlcm crash-history --limit 5`. A launch command reporting success did not establish that the app remained running.
7. For the control, save `assets/index.html`, replace it with static HTML referencing no JavaScript, and remove the added `allowFileAccess` prop to restore the template props. Rebuild, reinstall and launch. A new lifecycle crash was recorded with this control as well.

The two initial game-run reports and the static-HTML control report showed **SIGSEGV**, program counter `0x0`, with the next stack frame in `libkeplerscript-webview-lib-2.so.2.0` at offset `0x2471ba`. This identifies a native WebView failure path, not its root cause. The control reproduces a crash without running the board or bot code; it does not yet prove an upstream SDK defect or rule out shell configuration and emulator graphics issues.

To retain native reports locally, create an output directory first and use:

```bash
vega device get-log-info -d emulator-5554
vega device copy-logs -d emulator-5554 \
  --artifact SYSTEM_TOMBSTONE/acr --directory <existing-local-directory>
```

Do not use `vda install` for these VPKGs: the installed VDA command rejected them as non-APK/APEX files. Use `vega device install-app`.

## Verification still required

- Resolve the native crash with a minimal official WebView shell. Check SDK/VVD compatibility and a controlled supported runtime comparison before changing the game architecture.
- Establish reliable visual inspection. The desktop automation could not select the emulator executable as an app; a QEMU framebuffer screenshot was black, which is not sufficient evidence of what the accelerated window displayed. The device screenshot command did not finish during this experiment.
- Verify local module scripts, Worker creation and response, Unicode chess glyphs, remote D-pad/OK/Back, persistence across termination, and network-disabled cold start.
- Review template dependencies and combined redistribution licensing before importing a shell into the repository or distributing a binary.

The native crash occurs before the planned gameplay acceptance checks. No Vega gameplay, offline cold-start or TV remote-input success is claimed.

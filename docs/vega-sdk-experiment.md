# Vega SDK experiment — 21 September 2026

## Result

SDK installation and ARM64 release-package builds work on this MacBook Air. The user confirmed the native Hello Vega screen. SDK 0.24.12044 / VVD OS 1.2 consistently crashed both the game shell and minimal WebView controls. A controlled comparison with SDK 0.23.9221 / VVD OS 1.1 kept the RN 0.72 WebView control running with no crash records. The packaged board shell also remains running on 0.23, including its renderer service; visual rendering and gameplay are awaiting confirmation. The browser probe remains the only validated gameplay environment.

This is a local experiment outside the repository, under `~/vega/samples`. Generated SDK templates, crash reports, dependency trees and binaries are not committed. The WebView sample was subsequently reduced to an inline HTML control with only a View and WebView component; its game entry page was saved as `game-index.html.saved`. Its other bundled game assets are unused by the control page.

## Environment and installation

- Host: Apple Silicon macOS; Node 26.8.2.
- Vega CLI: **1.3.4**.
- Installed SDKs: **0.24.12044** and **0.23.9221**, main channel; **0.23.9221 is now active** for the comparison below.
- SDK-provided Vega Virtual Device, 1920 × 1080, ARM64.
- Initial 0.24 template: React Native **0.83.0**; React **19.2.0**.
- `@amazon-devices/react-native-kepler`: **4.0.1+rn0.83.0**.
- `@amazon-devices/webview`: **4.0.2**.
- After both SDK installations and sample builds, the latest host check reported about **21 GiB free**. Recheck space before another SDK installation.
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

Use the actual VPKG path printed by the build with `vega run-app <path> com.fortemate.vegahelloprobe.main -d VirtualDevice`. Build and manifest validation passed. Installation and launch completed, and `vega device running-apps` listed the component. It was subsequently terminated to isolate the WebView run. The user subsequently supplied a screenshot showing the Hello Vega page and its four navigation tiles, confirming that the native template renders on this MacBook Air.

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

## Follow-up on the same MacBook Air

User-confirmed macOS prompts and a full emulator restart did not resolve the WebView crash. Manual launch from Terminal and from the installed-app tile also failed.

With SDK 0.24.12044 and its VVD (OS 1.2, release 21, build 2111244708030):

| Control                                                              | Result                                                    |
| -------------------------------------------------------------------- | --------------------------------------------------------- |
| RN 0.83 / WebView 4.0.2, only View + WebView with inline static HTML | New lifecycle crash                                       |
| RN 0.72 / react-native-kepler 2.1.0 / WebView 3.5.7, inline HTML     | SIGSEGV; native WebView frame at the same 0x2471ba offset |
| RN 0.83 minimal control, `--use-system-js-bundles false`             | Build produced a regular bundle; new lifecycle crash      |

The RN 0.72 control is a separate local sample, `~/vega/samples/VegaWeb72Probe`. These experiments change the JS/runtime branch while retaining the same VVD image; they do not establish that other SDK images or physical devices fail.

## SDK 0.23 comparison

The same Air was used; no installation on a work Mac or Windows computer was needed. SDK 0.24 was preserved alongside 0.23.

```bash
source ~/vega/env
vega sdk install 0.23.9221 --non-interactive
# Stop the running 0.24 virtual device before starting the other image.
vega sdk use 0.23.9221
vega --version
vega virtual-device start --display-res=1920,1080
```

The older VVD reports **OS 1.1, release 19, build 1911127759030**. The local RN 0.72 sample uses React 18.2.0, react-native-kepler 2.1.0 and WebView 3.5.7. Its generated manifest required OS 1.2 / IVega_1_2; those two requirement blocks were removed for this older-image diagnostic and the original manifest retained locally. The runtime loader remains IKeplerScript_2_0. This is a compatibility experiment, not a production target decision.

Rebuilding and installing the inline HTML control with SDK 0.23 succeeded. Repeated running-app checks listed the component; the new VVD's crash-history buffer remained empty. Next, the browser production assets were copied into that shell, with `allowFileAccess`, `javaScriptEnabled`, `domStorageEnabled`, `hasTVPreferredFocus` and `allowSystemKeyEvents`, using `file:///pkg/assets/index.html`. This package also built and installed successfully, remained running and started `com.amazon.webview.renderer_service`, without a recorded crash.

The shell displays load status above the WebView. A load event or a running process alone does not establish that module scripts, the board or Worker executed. User visual confirmation and the keyboard scenario are still required. The local sample currently contains the game shell; the minimal control source is preserved as `App.inline-control.tsx.saved`.

The comparison points to a difference between SDK/VVD environments. It does not isolate the exact native defect: the image, build tooling and manifest requirements changed together.

## Verification still required

- Confirm visual rendering and input with the non-crashing SDK 0.23 shell; separately investigate SDK 0.24 compatibility before choosing a release target.
- Establish reliable visual inspection. The desktop automation could not select the emulator executable as an app; a QEMU framebuffer screenshot was black, which is not sufficient evidence of what the accelerated window displayed. The device screenshot command did not finish during this experiment.
- Verify local module scripts, Worker creation and response, Unicode chess glyphs, remote D-pad/OK/Back, persistence across termination, and network-disabled cold start.
- Review template dependencies and combined redistribution licensing before importing a shell into the repository or distributing a binary.

SDK 0.23 avoids the observed lifecycle crash in these controls, but does not yet close the gameplay acceptance checks. No Vega gameplay, offline cold-start or TV remote-input success is claimed.

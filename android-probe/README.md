# Android TV compatibility probe

A bounded engineering prototype based on `next`. It exercises platform boundaries before moving the Vega application's folders or screens. It is not a playable Android port or a release candidate. The product application remains in `native/`.

## What it exercises

- The existing canonical `native/src/botJob.ts`, bundled as a local asset and evaluated in a separate Hermes Worklets runtime. The RN thread only transports serialized requests and validates replies through the existing `botClient`.
- Normal search, an invalid request, stale-position rejection, disposal, and a deliberately slow runtime. The three-second diagnostic CPU hold is separate from the real engine search and never changes a bot's algorithm or work budget.
- MMKV v4 through the existing synchronous `getString`/`set`/`delete` port, including a real partial-turn snapshot with dice and moves.
- RN TV D-pad/OK events, Back cancellation, Android lifecycle and window focus, and a visible RN heartbeat.
- Expo Audio completion, seeking, two concurrent players, individual volume settings, and teardown on background/blur. One original generated PCM tone and one pinned English tutorial MP3 are packaged offline.

The on-screen menu uses a single native focus target. D-pad changes the selected diagnostic; OK invokes it once through `Pressable`; Back cancels pending work and audio. This does not qualify the game's board focus, held-key behavior, accessibility, or full remote flow.

## Reproduce

Use Node from the repository's `mise.toml`, JDK 17, and an Android SDK. The initial native build downloads Gradle, Android dependencies, NDK 27.1.12297006 and CMake. Allow several GB of free disk space beyond the SDK/emulator installation.

From the repository root:

```sh
npm ci
npm ci --prefix android-probe
npm run check --prefix android-probe
npm run lint --prefix android-probe
npm test --prefix android-probe
npm run prebuild --prefix android-probe
```

Build the standalone local-test APK:

```sh
cd android-probe/android
NODE_ENV=production ./gradlew :app:assembleRelease \
  -PreactNativeArchitectures=arm64-v8a --max-workers=2 --console=plain
```

Set `JAVA_HOME` to JDK 17 and `ANDROID_HOME` to your SDK first. This uses the generated project's **debug signing key**, despite the Gradle variant's name. Do not publish it. Output: `android-probe/android/app/build/outputs/apk/release/app-release.apk`. This APK includes the JS bundle and assets and does not need Metro or Expo Go. Native directories and build artifacts are generated and ignored; configuration belongs in `app.json`, not an edited generated Gradle file.

Install on an explicitly selected emulator/device, then run the scripted smoke checks from `android-probe/`:

```sh
adb -s <serial> install -r android/app/build/outputs/apk/release/app-release.apk
python3 scripts/smoke.py --serial <serial>
```

`smoke.py` **clears only `com.fortemate.dicechesstv.probe` data** before starting. It sends D-pad, OK, Back and Home events, force-stops the probe to test persistence, and records events, logcat and a screenshot under `build/smoke/`. It never installs or clears the product app. Completion events are not human listening evidence.

`npm run bundle` creates a standalone Android JS export for a cheaper Metro check. Native compatibility still requires the APK build and device checks. CI builds a local-test APK on PRs and relevant `next` pushes; it does not deploy, upload an APK, release, or modify the contest site.

## Dependency decisions

Exact installed versions are locked in `package-lock.json`:

| Component                | Selected candidate                              |
| ------------------------ | ----------------------------------------------- |
| Expo                     | 55.0.32                                         |
| React Native TV          | 0.83.10-1, through the `react-native` npm alias |
| React                    | 19.2.0, matching this TV renderer               |
| Worklets                 | 0.7.4, with its own Babel plugin                |
| MMKV / Nitro Modules     | 4.3.2 / 0.37.1                                  |
| Expo Audio               | 55.0.18                                         |
| Expo Asset / File System | 55.0.20 / 55.0.26                               |
| TV config plugin         | 0.1.7                                           |
| Android API              | Minimum 24; compile/target 36                   |

These are probe choices, not an approved support matrix. The first generated project defaulted to API 22; Hermes rejected that native build because it requires API 24. `expo-build-properties` now sets 24 explicitly. Fire OS support needs model/API/ABI selection and physical-device testing. API 24 excludes older Android/Fire OS generations.

Metro resolves React and React Native from this package even when importing the existing shared controller code. Expo's runtime tsconfig alias resolution is disabled because the type-only React path must not redirect runtime imports to `@types/react`. The existing Vega and web package dependencies and lockfiles are unchanged.

The first emulator bot request exposed another boundary: Android Hermes rejected `class` syntax inside `eval`, although the APK bundled successfully and Node tests passed. The Android asset generator now applies the RN Babel preset with inline helpers to the pure engine bundle. An additional test invokes the installed Hermes compiler against that asset. This changes packaging syntax, not game rules or search policy.

The October 28 npm audit reports transitive Expo tooling findings (Zod and deepmerge). No compatible Zod 3/deepmerge patch was available in the inspected dependency set; the suggested automatic downgrade is not applied. Resolve the tooling dependency posture before treating these pins as production choices. No dev server is required for the standalone probe.

## Source and asset licenses

The original probe code uses the repository's AGPL-3.0-only license. The engine and existing controller remain under their existing licenses. Expo, React, React Native TV, Worklets, the MMKV JavaScript wrapper, Nitro Modules, and the TV plugin declare MIT licenses; underlying native libraries retain their own notices (including Tencent MMKV's BSD license). These are installed dependencies, not newly vendored source. A production app must generate and package the full dependency notices before distribution.

The PCM tone is generated by `scripts/assets.mjs`. The selected Thinkle MP3 is already vendored in `native/voices/elevenlabs-dicechess-tutorial-thinkle/`; its source license permits Fortemate Dice Chess applications on any platform. The asset script checks both the MP3 and license against `native/voices/voices.json`, then copies the unmodified MP3 and license to the generated asset directory. This does not grant others a license to those voices or authorize standalone redistribution. Keep `assets/voice-LICENSE.txt` with any internal APK handoff.

## Remaining gates

See [validation.md](validation.md) for observed results. Full game screens, tutorial sequencing, music crossfades/ducking, interruption recovery, repeated audio stress, accessibility, held keys, device latency, actual Fire OS hardware, and all other ABIs remain separate work. No production platform adapter or workspace migration is approved by a successful probe alone.

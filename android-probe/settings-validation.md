# Android TV Settings validation

Settings is enabled in the shared home menu, before About. Android exposes only
Sounds; the other Vega settings need their Android runtime behavior first.

## Shared behavior and persistence

`SettingsPanel` and its choice/ring rendering are extracted from Vega's game
screen. Vega uses every existing row; Android uses the Sounds row. Labels,
volume rings and hints remain shared. Android reuses the canonical sound
step/toggle/read/save functions: Left/Right changes the level, OK remembers the
level when muting and restores it when unmuting, and Up/Down stays on the single
row. Back returns to the selected Settings home row.

Preferences are written synchronously before the next value is shown, using a
separate MMKV settings store. Settings mounts no game or worker. Gameplay reads
the saved preferences when its effect service opens: mute prevents player
creation and delayed cues, and `soundGain` supplies the native player volume.
The default is Vega's level 10, replacing the prototype's fixed gain of 0.5.
The diagnostic audio probe retains its separate behavior. Failed storage reads
or writes show an error; the screen does not silently publish an unsaved choice.

## Builds

Standalone ARM64 Android TV release-variant APK, signed with the local debug key,
with bundled JavaScript/assets and no Metro server. SHA-256:

```text
785fd46098e27deeb12c39776afd94f96c1c41fcb191a3998cfff36398c5318a
```

Vega SDK local build 59, ARM64 package SHA-256:

```text
4e0f0284414fa476052f0839bc520c50db9873b637cd67201857af33c6789d87
```

## Checks

- `mise run check` passed: 337 core, 736 native and 13 browser tests, types,
  lint, formatting, Vega Metro bundle and browser build.
- Android types, lint and all 49 tests passed. Total: 1135 automated tests.
- Android and Vega package builds passed. All smoke scripts parsed.
- Android TV emulator: all four Settings groups passed. They cover all four
  directions, mute/unmute and volume after immediate process death, system
  Home/return, Back focus restoration, exact friend/bot rolled-turn saves,
  silent muted moves and native playback requests at the restored level.
- All nine home/menu regression groups also passed on this APK, for 13 Android
  groups in total. Disposable probe data was cleared only after the Settings
  preservation checks, to give the home suite its fresh-start precondition.
- Settings volume/muted screenshots and the seven-row home menu were visually
  inspected on Android. Controls, rings, descriptions and hints fit the tested
  viewport. Evidence: `android-probe/build/settings/` and `settings-home/`.
- The ARM64 Vega package was installed and launched on Vega Virtual Device.
  All eight Settings rows and original hints/rings were visually inspected.
  Up/Down changed focus, Left changed Sounds from 10 to 9, OK muted and
  restored it, Right returned it to 10, and Back restored Settings home focus.
  No game move was made. Evidence: `android-probe/build/settings-vega/`.

The menu expectations in tutorial and legacy migration scripts were updated;
those complete device suites were not rerun. No physical Fire TV Stick test
was performed. The Vega check is separate from Android emulator evidence.

## Reproduce and limits

Build and install the Android APK as described in [README.md](README.md), then
run from the repository root:

```sh
mise exec -- python3 android-probe/scripts/settings-smoke.py --serial <serial> \
  --output android-probe/build/settings
```

Use `--adb <path>` if needed. The suite preserves app data and uses normal UI to
replace the current game. It changes the sound preferences, leaving sound on at
level 4. No dice, game positions or moves are injected. Fresh UI hierarchy dumps
prove the Settings surface is active; old event reports cannot satisfy that
assertion. Screenshots and event/logcat records are retained in the ignored
output directory.

Android evidence covers Android TV 12/API 31 at 1920 x 1080, 320 dpi. Native
playback events and assigned gain do not qualify human listening; host audio is
disabled using the existing emulator workaround. Physical Android TV/Fire OS,
held keys, Android accessibility and TV media-volume integration remain separate
checks. No release, Appstore submission or deployment is included.

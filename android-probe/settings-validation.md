# Android TV Settings validation

Settings is enabled in the shared home menu, before About. Android exposes only
Sounds; the other Vega settings need their Android runtime behavior first.

## Shared behavior and persistence

`SettingsPanel` and its choice/ring rendering are extracted from Vega's game
screen. Vega uses every existing row; Android uses the Sounds row. Labels,
volume rings and hints remain shared. Android reuses the canonical sound
step/toggle functions: Left/Right changes the level, OK remembers the
level when muting and restores it when unmuting, and Up/Down stays on the single
row. Back returns to the selected Settings home row.

Preferences are written synchronously as one complete JSON value before the
next value is shown, using a separate MMKV settings store. The old two-key
format remains readable and is not overwritten; a successful change creates
the new value. Invalid new data is reported rather than silently reset.
Settings mounts no game or worker. Gameplay reads
the saved preferences when its effect service opens: mute prevents player
creation and delayed cues, and `soundGain` supplies the native player volume.
The default is Vega's level 10, replacing the prototype's fixed gain of 0.5.
The diagnostic audio probe retains its separate behavior. Failed storage reads
or writes show an error in Settings; it does not publish an unsaved choice.
Game sound setup failures are reported as `sound-error` and leave effects
disabled without setting the game error or blocking moves.

## Initial implementation builds

Standalone ARM64 Android TV release-variant APK, signed with the local debug key,
with bundled JavaScript/assets and no Metro server. SHA-256:

```text
785fd46098e27deeb12c39776afd94f96c1c41fcb191a3998cfff36398c5318a
```

Vega SDK local build 59, ARM64 package SHA-256:

```text
4e0f0284414fa476052f0839bc520c50db9873b637cd67201857af33c6789d87
```

## Initial implementation checks

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

## Review fixes validated on 2026-10-30

- `mise run check`, Android types/lint and both platform builds passed. All
  1140 automated tests passed: 337 core, 736 native, 13 browser and 54 Android.
- New tests cover legacy preference migration, a single complete write,
  failed writes preserving both the displayed and reopened choice, malformed
  records/read failures, and continued game moves/saves when sound setup fails.
- A temporary diagnostic APK forced settings-store creation in
  `createAndroidEffects` to throw `QA: settings storage unavailable`.
  All seven `hotseat-smoke.py` groups passed on Android TV API 31, including
  legal remote moves, exact partial-turn restoration after force-stop and
  continued play. Four `sound-error` reports were observed, with no game
  load/save errors and no audio events. The restored board screenshot was
  visually inspected. This is simulated failure evidence, not a claim that
  the normal APK encountered an actual storage failure.
- The diagnostic source change was removed and the normal APK restored.
  The shared Vega panel change in this revision only marks props readonly;
  the initial Vega device and nine home/menu groups above were not rerun.
- The first normal-APK Settings run exposed a smoke-script race after an empty
  human roll: it treated the bot's move phase as a controllable human turn.
  The script now waits through bot and guarded turns before sending keys or
  choosing a move. A deterministic helper check also verified that those
  states receive no keys.
- The corrected Settings suite passed all four groups on the normal APK:
  D-pad/OK/Back, Home/return, mute and remembered volume after immediate
  process death, exact friend/bot rolled-turn preservation, muted moves and
  native playback at level 4. Settings/game/effects logs contain no errors.
  Settings screenshots were visually inspected.

Normal Android APK SHA-256:

```text
4583712df966e8e3635c6f4ac97c67450ca642950236694a787d2e52d27d2467
```

Diagnostic Android APK SHA-256 (local validation only):

```text
e586db3506bfa648e338a499ecdc2ce9fec52594387a4f3260183212809affb9
```

Rebuilt ARM64 Vega package SHA-256:

```text
255b13d5aff5eaa5f80777399cd8b112ad19688a87fc0307360d37e455527b6e
```

Local evidence is retained under `android-probe/build/settings-review/`:
`normal.apk`, `sound-failure.apk`, the `failure/` diagnostic smoke output, and
`normal/` for the first Settings run and `normal-retry/` for the successful
corrected suite. The diagnostic
injection is not part of the committed source.

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

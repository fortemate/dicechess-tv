# Android TV compatibility probe

A bounded engineering prototype based on `next`. It exercises platform boundaries before moving the Vega application's folders or screens. It includes playable two-player and Rolly bot slices, but is not a complete Android port or a release candidate. The product application remains in `native/`.

## What it exercises

- The existing canonical `native/src/botJob.ts`, bundled as a local asset and evaluated in a separate Hermes Worklets runtime. The RN thread only transports serialized requests and validates replies through the existing `botClient`.
- Normal search, an invalid request, stale-position rejection, disposal, and a deliberately slow runtime. The three-second diagnostic CPU hold is separate from the real engine search and never changes a bot's algorithm or work budget.
- MMKV v4 through the existing synchronous `getString`/`set`/`delete` port, including a real partial-turn snapshot with dice and moves.
- RN TV D-pad/OK events, Back cancellation, Android lifecycle and window focus, and a visible RN heartbeat.
- Expo Audio completion, seeking, two concurrent players, individual volume settings, and teardown on background/blur. One original generated PCM tone and one pinned English tutorial MP3 are packaged offline.
- A local two-player game using the shared `Board`, `Dice` and `screenReducer`, with D-pad/OK/Back, pause, confirmed replacement/resignation, and automatic MMKV saves. Its independent storage namespace keeps diagnostic snapshots separate.
- All 12 shared piece components and three SVG fallback faces from `native/src/`, rendered by Android `react-native-svg`. The gallery shows every component at 48 or 114 dp, with D-pad selection, OK to switch size, and Back to return to the diagnostics.

The menu, SVG gallery and game each use a single native focus target. D-pad changes the selection; `Pressable` supplies completed OK presses. Back returns from the gallery, pauses/deselects in the game, or cancels pending work and audio in the diagnostic menu. The emulator checks cover discrete key presses; held-key behavior, accessibility and physical remote behavior remain separate work.

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

`smoke.py` **clears only `com.fortemate.dicechesstv.probe` data** before starting. It sends D-pad, OK, Back and Home events, force-stops the probe to test persistence, and records events, logcat, the menu screenshot and SVG gallery screenshots at both sizes under `build/smoke/`. Screenshot inspection is separate from the script's state/event assertions. It never installs or clears the product app. Completion events are not human listening evidence.

`npm run bundle` creates a standalone Android JS export for a cheaper Metro check. Native compatibility still requires the APK build and device checks. CI builds a local-test APK on PRs and relevant `next` pushes; it does not deploy, upload an APK, release, or modify the contest site.

## Play with a friend

Choose **Play with a friend**, the last diagnostic. It opens the saved two-player
game, or creates one if no save exists. D-pad chooses a highlighted piece or a
legal destination; OK rolls, selects and moves. OK after a completed turn passes
to the other player and rolls their dice. Back cancels a selected piece first,
then opens the game menu. The menu offers Resume, Resign, Agree a draw, New game
and Diagnostics. Replacement and resignation use the shared confirmation flow,
with Cancel first. After a result, the menu offers New game and Diagnostics.

Every game transition is validated and written synchronously before it is shown.
Cursor movement does not write the save. Home, return to diagnostics and process
restart preserve the canonical snapshot, including the partial turn and spent
dice. Corrupt saves and storage failures show an error and keep the existing
save; the slice does not silently reset data or implement a damaged-save recovery
menu. Music, voices, additional opponents, tutorial, settings and accessibility qualification remain
separate work. See [hotseat-validation.md](hotseat-validation.md) for observed
results and input limits.

Game transitions also play the existing dice, move, capture, castling, promotion,
no-move and result effects through Expo Audio. Effects start only after the save
succeeds; opening a saved game is silent. Home, window blur and leaving the game
release active players and cancel delayed cues. Returning does not replay them.
The TV's media volume is expected to adjust or mute this slice, but has not been verified. An in-game sound setting,
music and character voices are not included. See [sound-validation.md](sound-validation.md).

After installing the APK, run the gameplay check from `android-probe/`, with Node
from mise on PATH:

```sh
mise exec -- python3 scripts/hotseat-smoke.py --serial <serial> --audio
```

This force-stops the disposable probe and **replaces its hotseat game through the
confirmation UI**, without clearing app data or injecting moves/dice. The
existing `smoke.py` still clears all probe app data, including its hotseat save;
run it first if exercising both suites. Gameplay screenshots and event reports
are written to the ignored `build/hotseat-smoke/` directory. `--audio` also checks native playback/completion events, silent restoration, and Home interrupting an active result jingle; it finishes with an agreed draw. Events do not establish human listening quality.

## Play against Rolly

Choose **Play against Rolly**, immediately above **Play with a friend**. This
first bot slice fixes the player to White and uses Rolly's existing `random`
mode (`random-king-capture` in the canonical engine). Other opponents and a side
chooser are not included yet. Its `dicechess-android-bot` MMKV namespace keeps
its game separate from the two-player save and diagnostic snapshots.

Play your moves with D-pad and OK. At the end of your turn, OK hands control to
Rolly. The packaged engine computes a complete legal turn in the existing
background Worklets runtime; the shared reducer validates the reply and reveals
one move at a time using its existing presentation pace. Search strength is
unchanged. The RN thread never falls back to a synchronous search.

[Node tests](test/bot.test.ts) demonstrate that a reply arriving behind Home or
the menu cannot update the board/save until presentation resumes, that returning
to the same position reuses the outstanding answer, and that disposal discards
a late reply. Code inspection of [botDriver.ts](src/botDriver.ts) and
[worker.ts](src/worker.ts) shows that presentation is gated separately from the
worker request; computation may finish while hidden, but native calculation
lifetime after disposal has not been measured. The
[emulator run](bot-validation.md#emulator-observations) observed Back opening the
menu during Rolly's turn, no saved-game transitions while Home was active, and
exact dice, position and phase recovery after a process restart before the first
bot move. The Node restore test covers restarting after one saved bot move and
verifies that the driver requests only the remaining moves from that saved game.

The menu offers Resume, Resign, New game and Diagnostics. Replacement and
resignation require confirmation. New game keeps Rolly and the player's White
side. A result stays on the board; OK opens the limited rematch/diagnostics menu.
Worker failures preserve the saved turn and show an error. Back or OK returns to
diagnostics; reopening retries the saved position without resetting the game.

Run the bot check after installing the APK:

```sh
mise exec -- python3 android-probe/scripts/bot-smoke.py --serial <serial> \
  --output android-probe/build/bot-game
```

It replaces the bot game through confirmation, uses normal random rolls and
remote events, and checks bot turns, menu/Home pause, process recovery, save
separation and rematch. It does not inject dice, moves or a diagnostic search
delay. See [bot-validation.md](bot-validation.md) for the evidence and limits.

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
| React Native SVG         | 15.15.3                                         |
| Expo Asset / File System | 55.0.20 / 55.0.26                               |
| TV config plugin         | 0.1.7                                           |
| Android API              | Minimum 24; compile/target 36                   |

These are probe choices, not an approved support matrix. The first generated project defaulted to API 22; Hermes rejected that native build because it requires API 24. `expo-build-properties` now sets 24 explicitly. Fire OS support needs model/API/ABI selection and physical-device testing. API 24 excludes older Android/Fire OS generations.

The SVG version matches the [Expo SDK 55 recommendation](https://docs.expo.dev/versions/v55.0.0/sdk/svg/). Its installed license is MIT; the shared RhosGFX piece and face artwork retains its existing CC0 provenance. No artwork is copied or regenerated for Android.

Metro resolves React, React Native and React Native SVG from this package even when importing the existing shared controller code. Expo's runtime tsconfig alias resolution is disabled because the type-only React path must not redirect runtime imports to `@types/react`. The existing Vega and web package dependencies and lockfiles are unchanged.

The first emulator bot request exposed another boundary: Android Hermes rejected `class` syntax inside `eval`, although the APK bundled successfully and Node tests passed. The Android asset generator now applies the RN Babel preset with inline helpers to the pure engine bundle. An additional test invokes the installed Hermes compiler against that asset. This changes packaging syntax, not game rules or search policy.

The October 28 npm audit reports transitive Expo tooling findings (Zod and deepmerge). No compatible Zod 3/deepmerge patch was available in the inspected dependency set; the suggested automatic downgrade is not applied. Resolve the tooling dependency posture before treating these pins as production choices. No dev server is required for the standalone probe.

## Source and asset licenses

The original probe code uses the repository's AGPL-3.0-only license. The engine and existing controller remain under their existing licenses. Expo, React, React Native TV, Worklets, the MMKV JavaScript wrapper, Nitro Modules, and the TV plugin declare MIT licenses; underlying native libraries retain their own notices (including Tencent MMKV's BSD license). These are installed dependencies, not newly vendored source. A production app must generate and package the full dependency notices before distribution.

The PCM tone is generated by `scripts/assets.mjs`. The selected Thinkle MP3 is already vendored in `native/voices/elevenlabs-dicechess-tutorial-thinkle/`; its source license permits Fortemate Dice Chess applications on any platform. The asset script checks both the MP3 and license against `native/voices/voices.json`, then copies the unmodified MP3 and license to the generated asset directory. This does not grant others a license to those voices or authorize standalone redistribution. Keep `assets/voice-LICENSE.txt` with any internal APK handoff.

The gameplay effects reuse the already-vendored packs in `native/sounds/`.
**Sounds by JDSherbert – https://jdsherbert.itch.io** (custom license with attribution);
Kenney casino/interface/jingle sounds are CC0. `scripts/assets.mjs` checks every
file against `native/sounds/sounds.lock.json` and copies the original bytes,
manifests and licenses. Keep `assets/sfx/*/LICENSE.txt` with any internal APK
handoff. These notices are generated sidecars, not an in-app credits screen.
No new sound assets, rights, dependencies or lockfile changes are introduced.

## Remaining gates

See [validation.md](validation.md) for the original probe results, [svg-validation.md](svg-validation.md) for the SVG check, and [hotseat-validation.md](hotseat-validation.md) for the playable two-player slice. Full game screens, tutorial sequencing, music crossfades/ducking, interruption recovery, repeated audio stress, accessibility, held keys, device latency, actual Fire OS hardware, and all other ABIs remain separate work. No production platform adapter or workspace migration is approved by a successful probe alone.

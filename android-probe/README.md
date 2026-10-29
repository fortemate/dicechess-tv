# Android TV compatibility probe

A bounded engineering prototype based on `next`. It exercises platform boundaries before moving the Vega application's folders or screens. It includes playable two-player and computer-opponent slices, but is not a complete Android port or a release candidate. The product application remains in `native/`.

## What it exercises

- The existing canonical `native/src/botJob.ts`, bundled as a local asset and evaluated in a separate Hermes Worklets runtime. The RN thread only transports serialized requests and validates replies through the existing `botClient`.
- Normal search, an invalid request, stale-position rejection, disposal, and a deliberately slow runtime. The three-second diagnostic CPU hold is separate from the real engine search and never changes a bot's algorithm or work budget.
- MMKV v4 through the existing synchronous `getString`/`set`/`delete` port, including a real partial-turn snapshot with dice and moves.
- RN TV D-pad/OK events, Back cancellation, Android lifecycle and window focus, and a visible RN heartbeat.
- Expo Audio completion, seeking, two concurrent players, individual volume settings, and teardown on background/blur. One original generated PCM tone and one pinned English tutorial MP3 are packaged offline.
- A local two-player game using the shared `Board`, `Dice` and `screenReducer`, with D-pad/OK/Back, pause, confirmed replacement/resignation, and automatic MMKV saves. The current-game namespace keeps diagnostic snapshots separate.
- All 12 shared piece components and three SVG fallback faces from `native/src/`, rendered by Android `react-native-svg`. The gallery shows every component at 48 or 114 dp, with D-pad selection, OK to switch size, and Back to return to the diagnostics.

The home screen, diagnostics, SVG gallery and game each use a single native focus target. D-pad changes the selection; `Pressable` supplies completed OK presses. Back leaves the app from home, returns from the gallery, pauses/deselects in the game, or cancels pending work/audio in diagnostics. Back in diagnostics returns home when no worker or audio player remains. The emulator checks cover discrete key presses; held-key behavior, accessibility and physical remote behavior remain separate work.

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

## Home screen

The APK launches into **Dice Chess**. Its supported menu entries use the Vega
menu definitions, labels and order: **Resume game** (when a current unfinished
game exists), **Play a friend**, **Play the computer**, **Learn to play**, and **Rules reference**.
Settings and About remain hidden until their Android screens are supported.

There is one current game, regardless of opponent or two-player mode. D-pad
moves the highlight, OK selects, and Back leaves the app. Returning from a game
restores the selected home row. A cold launch stays on home without mounting a
game, playing effects or starting the bot. Resume restores the exact saved turn.

Play a friend and Play the computer enter Vega's shared home actions. Switching
modes also replaces the current game, so a live-game replacement requires
Cancel/Yes after any opponent/side choices. Cancel or Back preserves the save.
An ended game does not appear as Resume and can be replaced without confirmation.
Unreadable saves show an error and are never silently cleared or overwritten.

### Existing saves

The current snapshot uses `game.v1` in `dicechess-android-game`. On an upgrade
with older saves but no current snapshot, a one-time chooser lets the player
select a game to carry forward. Its exact validated snapshot is copied before
continuing. Both old namespaces (`dicechess-android-hotseat` and
`dicechess-android-bot`) remain untouched, including the unselected game or
invalid data. They are retained for recovery; the normal menu uses only the new
current slot. A successful migration is not repeated on later launches.
A write failure leaves the choice available for retry. Invalid legacy data is
reported without replacing it. There is no in-app archive/recovery browser yet.

### Engineering diagnostics

Diagnostics is absent from the ordinary menu. Open it explicitly on a selected
development device with the probe's diagnostic link:

```sh
adb -s <serial> shell am start -a android.intent.action.VIEW \
  -d dicechess-probe://diagnostics \
  -n com.fortemate.dicechesstv.probe/.MainActivity
```

The link works at cold launch and while the activity is running. Other URLs do
not select diagnostics. The **Main menu** diagnostic action disposes pending
work and returns home; Back cancels retained work/audio or returns home when
none remains. Direct game diagnostics start the selected mode through the same
replacement flow and use the current slot, with Diagnostics as their exit target.
The diagnostic snapshot tests retain their separate engineering namespace.

Run `home-smoke.py` after `smoke.py` for fresh-start checks, before scripts that
create game saves:

```sh
mise exec -- python3 android-probe/scripts/home-smoke.py --serial <serial> \
  --output android-probe/build/home-menu
```

See [home-validation.md](home-validation.md) for the build, evidence and limits.

## Learn to play

Open **Learn to play** from home to use Vega's existing `TutorialScreen`, lesson
reducer, board and six canonical lessons. D-pad chooses a piece or destination;
OK rolls, selects, moves and advances completed lessons. Back puts a selected
piece down first, then leaves the tutorial. A missed capture offers a retry.
The lessons have their own fixed positions and rolls and receive no game store,
ledger or bot worker. Starting, completing or leaving them does not change the
current real game.

The closing screen offers **Play Rolly** (as White), **Play a friend**, and
**Main menu**. The first two enter Vega's shared new-game action and ask for
Cancel/Yes before replacing an unfinished game. Cancel or Back preserves the
save; Yes persists the chosen new game. A fresh or ended game starts directly.
Leaving the tutorial or canceling replacement restores the Learn to play home
selection. Reopening starts at lesson one. System Home/return keeps the current
lesson in memory. After process death the app returns home, where Resume game
restores the saved real game.

This slice uses the shared text and visual instructions without tutorial audio.
Voice sequencing, the first-launch tutorial offer, and character portrait asset
packaging remain separate Android work. The shared screen reserves Thinkle's
portrait space when the Vega package image is unavailable; his name and lesson
text remain visible. No new assets or dependencies are introduced.

The Thinkle portrait placeholder was visually inspected in tutorial screenshots
on the Android TV emulator. It was not validated on a Vega Virtual Device or
Fire TV Stick.

```sh
mise exec -- python3 android-probe/scripts/tutorial-smoke.py --serial <serial> \
  --output android-probe/build/tutorial
```

The script keeps app data and replaces the current probe game through the normal
confirmation UI. It drives every lesson with real remote keys, checks the screen's
state reports against the shared reducer, captures lesson screens, and verifies
exact friend and bot partial-turn recovery after leaving lessons and process death.
See [tutorial-validation.md](tutorial-validation.md) for evidence and limits.

## Rules reference

Open **Rules reference** from home or the in-game menu. Both entry points render
Vega's existing `RulesScreen`, including its nine topics, text, two-column layout
and navigation reducer. Up/Down changes topics and wraps; Left/Right and OK keep
the current topic open. Back returns to the opener with its Rules reference row
selected. Opening from home does not create or resume a game.

While rules are open from a game, the game session stays mounted but hands the
remote to the guide. Dice, spent moves and the saved position stay unchanged.
Bot presentation remains paused through the guide and its return menu; work may
finish in the background, but a result is shown only after returning to play.
System Home/return preserves the selected topic. A process restart returns to
home, with the original game still resumable.

The Android `RemoteSurface` supplies the same single native focus target and
shared input channel to games and the standalone guide. The existing screen
reader hooks are present, but Android accessibility is not qualified by these
remote-only checks.

```sh
mise exec -- python3 android-probe/scripts/rules-smoke.py --serial <serial> \
  --output android-probe/build/rules-reference
```

The script retains app data and replaces only the current probe game through
confirmation. It captures every topic, tests both entry points and lifecycle
recovery, and reads rules during a real bot turn. See
[rules-validation.md](rules-validation.md) for evidence and limits.

## Play with a friend

Choose **Play a friend**, or **Resume game** for the current two-player game.
D-pad chooses a piece or destination; OK rolls, selects and moves. OK after a
completed turn passes to the other player and rolls their dice. Back cancels a
selected piece first, then opens the game menu. Its shared entries are Resume
game, Resign, Agree a draw, New game, Main menu (Diagnostics when opened
there), and Rules reference. Replacement and resignation use Vega's confirmation flow, with Cancel
first. After a result, OK or Back returns to the main menu, as on Vega.

Every game transition is validated and written synchronously before it is shown.
Cursor movement does not write the save. Home, return to diagnostics and process
restart preserve the canonical snapshot, including the partial turn and spent
dice. Corrupt saves and storage failures show an error and keep the existing
save; the slice does not silently reset data or implement a damaged-save recovery
menu. Music, voices, settings and accessibility qualification remain
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

This force-stops the disposable probe and **replaces its current game through the
confirmation UI**, without clearing app data or injecting moves/dice. The
existing `smoke.py` still clears all probe app data, including its current and legacy saves;
run it first if exercising both suites. Gameplay screenshots and event reports
are written to the ignored `build/hotseat-smoke/` directory. `--audio` also checks native playback/completion events, silent restoration, and Home interrupting an active result jingle; it finishes with an agreed draw. Events do not establish human listening quality.

## Play against the computer

Choose **Play the computer** on home, then Rolly (Easy), Grabby (Medium) or Rampage (Hard),
then Random, White or Black. These are the shared opponent definitions and
canonical algorithms; the Android screen does not define separate bot strengths.
Back returns to the opponent chooser or home without creating a save. The direct
**Play against computer** diagnostic starts through the same replacement flow.

The **Resume game** row opens a saved game directly, keeping its opponent, color and full turn snapshot.
Earlier Rolly/White saves remain compatible. Random resolves the player's color
once when the new game starts, and that resolved side survives a restart. Black
plays with a flipped board and matching D-pad navigation; the computer plays
White's opening turn. An empty roll uses the shared prompt/OK guard.

The current-game namespace is shared with two-player play. Selecting another
opponent or switching to Play a friend replaces this game only after confirmation.

Play your moves with D-pad and OK. At the end of your turn, OK hands control to
the opponent. The packaged engine computes a complete legal turn in the existing
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

The menu offers Resume game, Resign, New game, Main menu (Diagnostics when opened there), and Rules reference. Replacement and
resignation require confirmation while a game is in progress. New game opens
opponent and side selection again, with Cancel first at the final replacement
confirmation. A computer-game result opens Vega's **Rematch / Main menu** menu
(Diagnostics when opened there). Rematch starts immediately against the same
opponent with the same color preference; Random draws the side again. Back
returns home. The shared reducer handles these actions without a separate
Android result flow.
Worker failures preserve the saved turn and show an error. Back or OK returns to
the screen it was opened from; reopening retries the saved position without resetting the game.

Run the bot check after installing the APK:

```sh
mise exec -- python3 android-probe/scripts/bot-smoke.py --serial <serial> \
  --output android-probe/build/bot-game
```

It replaces the current game through confirmation, uses normal random rolls and
remote events, and checks bot turns, menu/Home pause, process recovery and same-opponent
rematch. It does not inject dice, moves or a diagnostic search
delay. The original Rolly-only evidence remains in [bot-validation.md](bot-validation.md).
Run the selection suite after `smoke.py` (which clears the probe's data) to also
check cancellation before the first saved bot game:

```sh
mise exec -- python3 android-probe/scripts/selection-smoke.py --serial <serial> \
  --output android-probe/build/opponent-selection
```

This replaces the current save through the UI and checks all nine opponent/side
choices, D-pad moves and exact process recovery. The selection behavior and
current validation limits are recorded in [selection-validation.md](selection-validation.md).

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

See [validation.md](validation.md) for the original probe results, [svg-validation.md](svg-validation.md) for the SVG check, and [hotseat-validation.md](hotseat-validation.md) for the playable two-player slice. Full game parity, tutorial voice sequencing, music crossfades/ducking, full audio interruption recovery, repeated audio stress, accessibility, held keys, device latency, actual Fire OS hardware, and all other ABIs remain separate work. No production platform adapter or workspace migration is approved by a successful probe alone.

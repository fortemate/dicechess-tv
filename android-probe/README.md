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

## First launch

On a new profile, Thinkle offers **Learn to play** or **Skip** before home.
The board, portrait, captions, voice lines, choices and navigation use Vega's
existing components and reducer. Learn to play is selected initially; D-pad
wraps between the choices. OK opens lesson one or home. Back answers Skip and
returns home without exiting the app.

The answer is saved in the Android settings store before leaving the offer.
Navigation alone does not answer it: an unanswered offer appears again after
a process restart. Current or legacy game data, even unreadable data, suppresses
the offer without changing the saved game. An explicit Start fresh reset also
identifies a returning player. Failed startup reads bypass onboarding; a failed
answer write shows a retry message and keeps the offer available. Engineering
diagnostic links bypass onboarding.

Mounted Android tests cover eligibility, persistence, rapid repeated input and
read/write failures. `tutorial-offer-smoke.py` on Android TV API 31 checks the
real upgrade profile and a separate clean emulator profile. See
[tutorial-offer-validation.md](tutorial-offer-validation.md) for reproduction,
observations and limits. Physical remotes, TalkBack and Vega runtime have not
been qualified by this Android change.

## Home screen

After the first-launch offer, the APK opens the **Dice Chess** home screen.
Its supported menu entries use the Vega
menu definitions, labels and order: **Resume game** (when a current unfinished
game exists), **Play a friend**, **Play the computer**, **Learn to play**, **Rules reference**, **Settings**, and **About**.
Settings exposes the same eight controls as Vega; see Settings below.

There is one current game, regardless of opponent or two-player mode. D-pad
moves the highlight, OK selects, and Back leaves the app. Returning from a game
restores the selected home row. A returning player's cold launch stays on home without mounting a
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
current slot. A successful migration is not repeated on later launches. Explicit Start fresh
also records that retained legacy saves should not be offered again.
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

## Settings

Open **Settings** from home or the game menu to adjust **Music**, **Sounds**, **Voices**, **Highlights**,
**Auto-play only move**, **Play as**, **Turn board for friends**, and
**Host for friends**.
See [gameplay settings validation](game-settings-validation.md). Android and Vega render the
same `SettingsPanel`, labels, volume rings and remote hints. Left/Right changes
the selected value; OK toggles switches or cycles Highlights, Play as and Host for friends, and mutes/restores
the remembered Music, Sounds or Voices level. Up/Down selects a row, and Back restores focus
to the Settings row in the menu that opened it. Up from Resume game reaches
in-game Settings in one press. System Home/return keeps the panel open. Music follows the app lifecycle; see Music below.

Canonical stepping and mute behavior are reused. Android writes mute and volume
as one JSON value in a separate MMKV settings store before publishing it. Old
two-key preferences remain readable and are kept intact; the next successful
change writes the new format. A sound setup/storage failure is reported and
disables effects for that game screen, while the saved game stays playable.
Home Settings mounts no game or bot. In-game Settings keeps the current session
mounted and pauses bot delivery and automatic moves. Opening gameplay reads those preferences: muted effects create no
players, and the shared decibel curve sets the native player volume. These
preferences do not change the explicit diagnostic audio probe. The default is
Vega's level 10; the earlier probe used a fixed native gain of 0.5.

```sh
mise exec -- python3 android-probe/scripts/settings-smoke.py --serial <serial> \
  --output android-probe/build/settings
```

The suite keeps app data and replaces the current game through normal UI.
It checks fresh UI hierarchy, real remote input, immediate process death,
friend/bot save preservation, muted effects and requested playback gain.
See [settings-validation.md](settings-validation.md) for evidence and limits.

## About

Open **About** from home for the game name, maker, asset authors and source
address. It reuses Vega's `AboutScreen` and remote behavior with content supplied
by the Android build: shared RhosGFX pieces and fallback faces, JDSherbert piece
sounds, Kenney dice/result sounds, and pepka-prygni music. Author names, licenses and links retain
the canonical credit wording. Android does not attempt Vega's hidden portrait-file probe.

The source row points to the repository and its asset notices. It does not claim
that complete dependency licenses ship in this prototype APK: generating and
packaging those Android notices remains a distribution gate. Vega's default
credits, portrait detection and notice text stay the same.

All four directions keep the single page open. OK or Back returns to the
selected About home row. System Home/return retains the screen. Opening About
mounts no game or bot worker and does not write a game snapshot; after process
death, Resume game restores the exact current turn.

```sh
mise exec -- python3 android-probe/scripts/about-smoke.py --serial <serial> \
  --output android-probe/build/about
```

The script keeps app data and replaces only the current probe game through the
normal UI. It checks the screen report, directions, OK/Back, Home/return and exact
friend/bot partial-turn preservation after process death. Visual attribution and
platform-specific evidence are recorded in [about-validation.md](about-validation.md).

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
Leaving a tutorial opened from home or canceling replacement restores the Learn to play home
selection. Reopening starts at lesson one. System Home/return keeps the current
lesson in memory. After process death the app returns home, where Resume game
restores the saved real game.

The shared tutorial sequences local Thinkle recordings using decoder completion
callbacks and honors Voices mute/volume. The first-launch offer uses the same
speech adapter. Thinkle uses the shared Teacher and Portrait components with the pinned
local Android image pack. See [portrait validation](portraits-validation.md).
The tutorial voice behavior is covered by the [speech unit tests](test/speech.test.ts)
and an Android TV emulator run of the [voice smoke test](scripts/voices-smoke.py).
Vega Virtual Device and physical-device validation of this Voices change remain pending.

Earlier tutorial evidence used a portrait placeholder; the portrait validation
records the Android image check.

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
there), Rules reference, and Settings. Replacement and resignation use Vega's confirmation flow, with Cancel
first. After a result, OK or Back returns to the main menu, as on Vega.

Every game transition is validated and written synchronously before it is shown.
Cursor movement does not write the save. Home, return to diagnostics and process
restart preserve the canonical snapshot, including the partial turn and spent
dice. Corrupt saves and storage failures show an error and keep the existing
save; the slice does not silently reset data or implement a damaged-save recovery
menu. Render failures use the shared Recovery screen described below.
Accessibility qualification remains
separate work. See [hotseat-validation.md](hotseat-validation.md) for observed
results and input limits.

Game transitions also play the existing dice, move, capture, castling, promotion,
no-move and result effects through Expo Audio. Effects start only after the save
succeeds; opening a saved game is silent. Home, window blur and leaving the game
release active players and cancel delayed cues. Returning does not replay them.
The TV's media volume remains unverified. The in-app Sounds control is available
from home or the game menu; see Settings above. Music and character speech use their independent settings.

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
then the side menu only when **Play as: Ask** is selected in Settings.
Play as defaults to **Random**, as on Vega; White and Black also start directly
from the opponent card. These are the shared opponent definitions and
canonical algorithms; the Android screen does not define separate bot strengths.
Back returns to the opponent chooser or home without creating a save. The direct
**Play against computer** diagnostic starts through the same replacement flow.

Changing Play as affects future games only; it does not change the current
game's side, position or roll. Preferences survive restart. See
[Play as validation](play-as-validation.md) for checks and limits.

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

The menu offers Resume game, Resign, New game, Main menu (Diagnostics when opened there), Rules reference, and Settings. Replacement and
resignation require confirmation while a game is in progress. New game opens
opponent selection again (and side selection for Ask), with Cancel first at the final replacement
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
handoff. The About screen shows these asset credits. The license files remain generated
sidecars; a complete Android dependency-notice bundle is still a distribution gate.
No new sound assets, rights, dependencies or lockfile changes are introduced.

## Remaining gates

See [validation.md](validation.md) for the original probe results, [svg-validation.md](svg-validation.md) for the SVG check, and [hotseat-validation.md](hotseat-validation.md) for the playable two-player slice. Full game parity, human listening and loop-seam assessment, full audio interruption recovery, repeated audio stress, accessibility, held keys, device latency, actual Fire OS hardware, and all other ABIs remain separate work. No production platform adapter or workspace migration is approved by a successful probe alone.

## Character portraits and opponent cards

Android uses Vega's `OpponentScreen` for the three opponent cards and its
`Portrait` renderer for the cards, gameplay badge and Thinkle in the tutorial.
A platform image-source provider supplies Metro's bundled images; Vega retains
its existing package paths. The pinned original PNGs and their notice are
verified during asset generation and packaged for offline use. The existing
fallback faces remain available when an image fails to load.

See [portrait validation](portraits-validation.md) for reproduction and limits.

## Host for friends

Choose Prowla (the Vega default), Rolly, Thinkle or Off in Settings. Left steps
backward; Right or OK steps forward. The choice uses the canonical storage key
and survives process restart. Changing it leaves the current game snapshot
intact and takes effect when gameplay reopens.

Friend games reuse Vega's host cue/pacing hook, portrait and speech bubble.
Commentary appears only while the board is visible. Off and computer games
show no host commentary. The Voices setting controls the spoken lines independently from effects;
muting voices keeps the captions. The commentary queue/bags live for the mounted Android game
screen; returning through home creates a new presentation session, while the
saved game retains its exact position, dice and phase.

See [host validation](host-validation.md) for reproduction and evidence.

## Voices

Voices uses Vega's default level 10, decibel curve and Left/Right/OK controls.
Mute and remembered volume are saved atomically in the Android settings store;
legacy Vega-format pairs remain readable. The setting applies to the next
opened game or lesson without modifying its saved game snapshot.

The Android speech adapter plays the existing pinned English recordings for
all three hosts, all three opponents and Thinkle's lessons. It keeps one voice
player, replaces stale lines, waits for decoder completion plus Vega's tail
before advancing tutorial speech, and releases playback on menus, exit,
background and blur. A returning tutorial restarts its current instruction;
gameplay does not replay a canceled line. Effects and voice mute are independent.
Music ducks while a native voice player is speaking and recovers when that line ends or is canceled.
These voice behaviors are covered by the [speech unit tests](test/speech.test.ts)
and an Android TV emulator run of the [voice smoke test](scripts/voices-smoke.py);
Vega Virtual Device and physical-device validation remain pending.

All 446 canonical recordings and nine original licenses are packaged offline.
Asset generation verifies their canonical hashes; no new recordings are made.
See [Voices validation](voices-validation.md) for evidence and limits.

## Music

Music reuses Vega's state selection and shared adaptive engine: menu, calm,
tense and critical themes, crossfades, pinned loop points, track gain and the
2.5-second result-jingle gap. Settings uses the same default level 7, 3 dB
steps and remembered mute/volume controls. A single `music.v1` JSON value is
written before the change is published; legacy preferences remain readable.
Initial gain and mute are applied before any track can play.

One app-lifetime Android service adapts Expo Audio to the shared engine.
Speech ducks music by 9 dB; completion, cancellation and voice-owner disposal
restore it. Home, blur and background release the music players. Returning
resumes the current theme from its in-session position on a fresh player
(shared engine tests); that position is not persisted across process death.
The Android TV emulator checks verify background release, foreground playback
and unchanged saved games. Music settings do not write the game snapshot.

All four existing MP3s and their original license are hash-checked and bundled
offline, with canonical attribution in About. The permission is for this same
Dice Chess game; it does not grant general music reuse rights. Keep the original
notice with internal APK handoffs. No tracks, dependencies or lockfiles change.

See [Music validation](music-validation.md) for emulator evidence, reproduction
and remaining listening/device checks.

## In-game Settings

The game menu includes Vega's Settings row and uses the shared reducer for row
navigation, value changes and Back return. The shared panel stays beside the
board, so Highlights and Turn board for friends update the current view.
Auto-play only move waits until gameplay resumes; Play as applies to future
games and leaves the current human side unchanged. Host changes follow Vega's
commentary hooks. These choices persist in the same store as home Settings.

Music, Sounds and Voices apply to the mounted services after a successful
preference write. Sounds volume updates active effects; mute releases them and
cancels delayed cues. Entering Settings stops speech. Back returns to the
Settings game-menu row, and Back again resumes the same turn. The session and
bot worker remain mounted; preference and navigation events do not rewrite the
game snapshot. Invalid preference reads or failed writes preserve the save.

See [in-game Settings validation](in-game-settings-validation.md) for emulator
evidence, reproduction and limits.

## Recovery from rendering errors

Routed screens are protected by Vega's `GameBoundary`. A React render failure
shows **Something went wrong**, with **Back to the menu** selected by default.
Android supplies a fresh remote surface after the failed screen unmounts.
`recovery-smoke.py` on the Android TV API 31 emulator verifies disposal of the
failed game's speech, effects and worker, and silent app-lifetime music on the
fallback, including after Home/return.

OK on Back to the menu returns home with Resume game focused and the exact save
kept. Directions alone change only the selection. Choosing **Start fresh** with
OK clears the current `game.v1` slot; settings and both older game namespaces
are retained. A marker prevents those retained legacy games from being offered
for migration again after the explicit reset. Mounted tests verify reset ordering,
storage-failure retry and preserving recovery. The Android TV API 31 emulator
smoke verifies Back's normal exit behavior and restoration of the existing save
on a normal cold launch. Vega runtime, physical remotes and TalkBack have not
been verified for this Recovery change.

The engineering fault link triggers a real render exception without injecting
a position, roll, save or preference:

```sh
adb -s <serial> shell am start -a android.intent.action.VIEW \
  -d dicechess-probe://diagnostics/recovery \
  -n com.fortemate.dicechesstv.probe/.MainActivity
mise exec -- python3 android-probe/scripts/recovery-smoke.py \
  --serial <serial> --output android-probe/build/recovery
```

The link is separate from the ordinary menu. Recovery covers React errors in
the routed screens; existing handled load/save/worker errors keep their current
messages. Native crashes and arbitrary asynchronous callback errors need their
own handling. See [Recovery validation](recovery-validation.md) for evidence.

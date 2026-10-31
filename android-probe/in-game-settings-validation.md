# Android TV in-game Settings validation

The game menu now includes Vega's Settings row. Up from Resume game reaches it
in one press. The shared `screenReducer` owns menu navigation, all eight Settings
rows and Back return to the Settings menu row. Back again resumes gameplay.
The shared `SettingsPanel` appears beside the board. Home Settings remains
available and uses the same preference keys and formats.

The session reads the independent preference store when Settings opens. Each
changed row is saved synchronously before publishing the next screen state or
updating audio. Opening, navigation, value changes and closing Settings do not
write the game snapshot. Failed preference reads/writes leave the previous
session state and saved game intact. Existing error handling offers a way home.

Highlights and Turn board for friends update the mounted board. Auto-play only
move waits while Settings or the game menu is visible, then follows Vega's normal
scheduler on return to play. Play as changes future games, preserving the current
human side. Host changes use Vega's existing commentary hooks; a midgame host
return does not invent a new introduction. The bot worker and game session stay
mounted; late replies wait through Settings and the return menu.

Music applies through the existing app-lifetime service. Sounds changes update
active-player gain, and mute releases players and cancels delayed cues. Voices
mute/gain update the mounted speech handle. Entering Settings stops speech.
These updates occur after preference persistence; no audio cue is replayed merely
because a setting changed.

## Reproduce

Build and install the standalone ARM64 APK as described in README, then run
from the repository root:

```sh
mise exec -- python3 android-probe/scripts/in-game-settings-smoke.py \
  --serial <serial> --output android-probe/build/in-game-settings
```

Add `--adb <path>` when necessary. The suite keeps app data and replaces the
probe's disposable games through the normal confirmation UI. It injects no
positions, dice, saves or preferences. It leaves audio enabled at level 4,
Play as White, Highlights Standard, auto-play off and turn-board off.

## Automated checks: October 31, 2026

- Android types/lint and 76 tests passed. New session tests retain exact friend
  and bot partially played turns through all eight rows and verify read/write
  failures cannot publish state or overwrite the save. Existing bot-driver
  regression now covers delayed replies through both Rules and Settings.
- Effect-adapter tests verify active gain changes, mute teardown, canceled
  delayed cues, restored gain and inert updates after disposal.
- `mise run check` passed: 337 core, 739 native and 13 browser tests, types,
  lint, formatting, Vega Metro bundle and browser build.
- Native typecheck and both mounted Android regressions passed in the clean CI
  fixture without Android dependencies. No native test file or LCOV path changed.
- The standalone ARM64 Android release APK and all configured Vega architectures
  built successfully.

## Runtime evidence

On DiceChessTVProbe (Android TV API 31, ARM64), all four in-game Settings groups
passed using real D-pad/OK/Back/Home events:

1. All eight rows apply in the mounted friend game. Back restores the Settings
   menu row and the exact partially played turn. Highlights and Black-bottom
   orientation update immediately; muting Sounds suppresses the next move cue.
2. Host speech and subsequent effects reach native playback at the chosen level
   without remounting the game. Home/return retains Settings, and process death
   restores the exact friend game and persisted preferences.
3. A bot partial turn and its human side remain unchanged while changing Settings.
   Play as affects the next game; force-stop/relaunch preserves the bot snapshot.
4. Auto-play only move waits in Settings, then performs a real sole legal move on
   return without a game-screen OK press. The suite then restores auto-play off.

Settings beside the rotated board and the automatic-move screen were visually
inspected. Native gain and decoder events prove player operations; they are not
a human listening assessment. Active-effect gain changes, delayed-cue cancellation
and late bot replies have deterministic test coverage. Physical remotes, held
keys, TalkBack, external audio-focus interruptions, prolonged audio stress and
Vega runtime remain separate qualification for this slice.

The existing home Sounds and Music suites each passed their four regression
groups. All four in-game Settings groups were repeated on the final APK.
The full Voices, tutorial and Rules suites were not rerun in this slice.

Local evidence is ignored under `android-probe/build/in-game-settings-final/`,
`android-probe/build/in-game-settings-effects/` and
`android-probe/build/in-game-settings-music/`.
The validated APK SHA-256 is
`c81b0df52a309a60efc02c3d81e44dcabf7cf015c6215971617bc7e64c145d25`.

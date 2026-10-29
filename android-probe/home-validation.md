# Shared Android TV menu validation

On October 29, 2026, the Android prototype adopted Vega's supported menu entries
and one current game. Ordinary launch opens Dice Chess, with Resume game when
an unfinished save exists, Play a friend and Play the computer. Diagnostics is
available only through an explicit engineering link. Unsupported learning,
rules, settings and About screens remain hidden.

## Implementation

`homeMenu` reads the existing definitions in `native/src/screen.ts`, preserving
IDs, labels and order. New-game actions enter the shared home reducer, including
cross-mode replacement and Cancel/Yes. In-game entries also use the shared menu.
Computer results expose the shared Rematch/Main menu actions; rematch retains
the opponent and color preference, drawing Random again. A two-player result
returns home on OK or Back. Ended games are not labeled Resume game.

`App` owns lifecycle and routing. Home, game and diagnostics retain one native
focus target each. The diagnostic link works on cold launch or through a live
link event; it is not a normal menu entry. Leaving diagnostics disposes work.

All normal games use `game.v1` in `dicechess-android-game`. If only legacy slots
exist, a chooser copies the selected validated snapshot into the new namespace.
Both original slots remain intact. An existing current snapshot takes precedence
on retry/restart. Corrupt data and write failures do not erase a snapshot or
publish a game transition. The retained legacy slots have no archive browser in
this slice; invalid saves still require manual recovery.

The canonical engine, Vega source, dependencies, lockfiles and assets are unchanged.

## Automated checks

- Android types, lint and 41 tests passed. Tests cover one-slot restoration,
  cross-mode Cancel/Yes, result/rematch, exact migration of either legacy game,
  current-slot precedence, corrupt/wrong-mode legacy data and write failures.
- All 41 Android tests also passed in an isolated source copy with only root
  and Android dependencies, without `native/node_modules`.
- `mise run check` passed: 337 core, 734 native and 13 browser tests, types,
  lint, formatting, Vega Metro bundle and browser build. Total: 1125 tests.
- Python scripts parsed successfully and `git diff --check` passed.

## Emulator observations

Standalone ARM64 APK on Android TV Android 12/API 31, 1920 × 1080 at 320 dpi.
The release variant is signed with the generated debug key and includes its
bundle/assets; no Metro server is required. APK SHA-256:

```text
6614172d8ba7c40f504cd118b792ed589d19b132f03aa39ba6d5723d2005b899
```

All 52 emulator check groups passed:

1. Five upgrade groups. Two games were created with the preceding APK through
   normal remote play. Updating without clearing data exposed the migration
   chooser; Back left it pending. The chosen computer game restored its exact
   position, dice, moves, phase and side. A subsequent move survived restart in
   the new current slot. Reinstalling the old APK still opened both original
   games unchanged; reinstalling the new APK resumed the advanced current game.
2. Nine ordinary-menu groups: shared labels/order, all four directions/wrap,
   no Diagnostics, first computer selection cancellation, exact current-game
   process restoration, no worker on home, cross-mode Cancel/Yes, same-opponent
   rematch, two-player result/home behavior, explicit diagnostic link and busy
   cleanup, activity exit and normal cold relaunch.
3. Eleven compatibility groups: canonical worker, stale/error/disposal paths,
   lifecycle, diagnostic persistence, native audio events and SVG gallery.
4. Eleven two-player/audio groups: legal remote moves, complete partial-turn
   restoration, cancellation, both sides playing, shared result/home flow,
   native playback events and interrupted-result cleanup.
5. Six Rolly groups: worker moves, Back/Home pause, process recovery, exact human
   partial-turn restoration and same-opponent/side rematch.

6. Ten opponent/side groups: all nine combinations, each with a legal remote
   move and exact process recovery, plus canceled replacement. First-launch
   cancellation is also covered by the ordinary-menu suite.

The old APK used for upgrade testing has SHA-256:

```text
d87271e10d6ca362884190bf5bd31e90842fc6660cfebad4abb58384a191996e
```

The upgrade suite compares full decoded games through each APK's normal UI.
Byte-preserving copy and failed-write behavior are additionally tested in Node.
No fixture, deterministic roll or privileged filesystem access was used in the
emulator migration test. Migration, fresh home, current-game home and computer
result screenshots were inspected; text and focus fit the screen.

## Reproduce

Build/install the APK as in [README.md](README.md). With Node from mise on PATH,
run from the repository root:

```sh
mise exec -- python3 android-probe/scripts/smoke.py --serial <serial> \
  --output android-probe/build/shared-menu-diagnostics
mise exec -- python3 android-probe/scripts/home-smoke.py --serial <serial> \
  --output android-probe/build/shared-menu-home
mise exec -- python3 android-probe/scripts/hotseat-smoke.py --serial <serial> \
  --audio --output android-probe/build/shared-menu-hotseat
mise exec -- python3 android-probe/scripts/bot-smoke.py --serial <serial> \
  --output android-probe/build/shared-menu-bot
mise exec -- python3 android-probe/scripts/selection-smoke.py --serial <serial> \
  --output android-probe/build/shared-menu-selection
```

Supply `--adb <path>` if needed. `smoke.py` clears only probe data, including
legacy slots. Later suites replace the current game through confirmation and
use normal random rolls. Outputs remain in ignored build directories. Playback
or completion events do not establish audible quality.

For migration, run before the data-clearing suite: retain the previous APK as
`build/menu-upgrade/before.apk`, create both saves with its preceding
`home-smoke.py`, and keep that run's `game-events.json` in
`build/menu-upgrade/before/` (paths relative to `android-probe/`). Keep the new
APK at its normal Gradle output path. Then run:

```sh
mise exec -- python3 android-probe/scripts/migration-smoke.py --serial <serial> \
  --output android-probe/build/menu-upgrade/after
```

This installs old/new APKs over one another on the selected disposable emulator,
without clearing data, and leaves the new APK installed. Run on probe data only.

## Limits

These are Android TV emulator and Node results, not physical Android TV or
Fire OS qualification. Held keys, accessibility, other ABIs, prolonged play,
learning/rules/settings/About, music and character voices remain separate work.
Host audio was disabled with `-no-window -gpu swiftshader -feature -Vulkan
-no-audio` to avoid the previously observed macOS CoreAudio stall. Native player
events are not human listening or host-audio stability evidence. The Vega
package's automated checks passed; its device build/runtime was not repeated
for this Android-only change.

# Android TV opponent and side selection

On October 29, 2026, the Android prototype added the shared opponent and side
choosers. Rolly, Grabby and Rampage use their existing canonical algorithms.
Random, White and Black use the same start and confirmation transitions as Vega.

## Behavior and persistence

The diagnostic entry is **Play against computer**. With no bot save, it opens
opponent selection, then side selection. Back unwinds those screens and returns
to diagnostics without saving the placeholder board. With a save, it restores
that game directly; New game opens selection again. Replacing a live game
requires confirmation, with Cancel first. A game that has ended can be replaced
without confirmation, following the shared reducer.

Random color is drawn once at committed game creation using the existing random
source and `randomSide`. The saved game contains both the requested color and
the resolved human side. The existing bot namespace and snapshot key stay the
same; earlier Rolly/White saves remain valid. Hotseat saves remain separate.
This is one bot save, not a separate slot per opponent.

For Black, `Board` receives the shared `flipped(game)` value used by navigation.
The existing driver starts the White opponent's turn automatically and saves
each transition before presentation. Opponent names and player sides in the
screen are derived from the current game. No engine, shared/Vega source,
dependency or lockfile changes are involved.

## Automated validation

- `mise run check`: 337 core, 734 native and 13 browser tests, types, lint,
  formatting, Vega Metro bundle and browser build passed.
- Android types, lint and 31 tests passed: 1115 tests across all packages.
- All 31 Android tests also passed in an isolated source copy with only root
  and Android dependencies, without `native/node_modules`.
- Node tests cover all opponent/color combinations with both random outcomes,
  exact restoration without another color draw, first-launch cancellation,
  confirmed/canceled replacement, old-save compatibility, separate hotseat
  saves, failed writes, Black navigation, and every opponent playing White first.
  Existing late-reply, lifecycle and partial-bot-turn recovery tests remain.
- Python smoke scripts parsed successfully. The remote route helper now follows
  the saved player's orientation when planning real D-pad events.

## Emulator evidence

Standalone ARM64 APK on `DiceChessTVProbe`, Android TV Android 12/API 31,
1920 × 1080 at 320 dpi. The release variant uses the generated debug signing key,
with its bundle/assets offline and no Metro server. APK SHA-256:

```text
19658fe03ae6cb75de082578bdbd79332472f0e3d0212b58eca4ab05c49084f4
```

All 39 check groups passed on that APK:

1. Eleven original diagnostics: workers, remote input during computation,
   lifecycle, persistence, audio and SVG.
2. Eleven hotseat/audio groups: normal moves, partial-turn recovery, menus,
   Home/return, result/rematch, and native playback/completion/cleanup events.
3. Eleven selection groups: first-launch Back/cancellation without a save,
   all nine opponent/color choices with a real human move and exact process
   recovery, and canceled replacement preserving the prior game.
4. Six Rolly regression groups: selected start, menu pause during the bot turn,
   Home/process recovery, a legal worker turn, separate hotseat storage, and
   resignation/rematch through the new selectors.

The selection run resolved Random to White for Rolly/Grabby and Black for
Rampage. Explicit Black choices also restored the same side, orientation,
position, dice and phase. Opening empty rolls followed the shared OK guard. A separate normal-roll
Grabby/Black follow-up also observed a legal White opening through the packaged
worker and the handoff to the human player.
Opponent/side chooser screenshots and Black gameplay screenshots were inspected:
labels fit, the Black pieces were at the bottom, and the visible selection and
D-pad moves followed that orientation.

Earlier runs stalled in the emulator. A host process sample showed QEMU's I/O
lock waiting in macOS CoreAudio. The completed selection and Rolly regression
runs used a headless emulator with `-gpu swiftshader -feature -Vulkan -no-audio`;
the diagnostics and hotseat/audio groups passed separately with host audio
still enabled. Thus the new selection run is gameplay evidence with host audio
disabled, not a listening or sustained host-audio stability result.

## Reproduce

Build and install the standalone APK using [README.md](README.md), then run from
the repository root with Node from mise on PATH:

```sh
mise exec -- python3 android-probe/scripts/smoke.py --serial <serial> \
  --output android-probe/build/selection-diagnostics
mise exec -- python3 android-probe/scripts/hotseat-smoke.py --serial <serial> \
  --audio --output android-probe/build/selection-hotseat
mise exec -- python3 android-probe/scripts/selection-smoke.py --serial <serial> \
  --output android-probe/build/opponent-selection
mise exec -- python3 android-probe/scripts/bot-smoke.py --serial <serial> \
  --output android-probe/build/selection-bot
```

Supply `--adb <path>` if needed. The first suite clears only the disposable probe's
data. The remaining suites replace their respective games through the UI. Run
selection before the bot regression to exercise cancellation with no bot save.
They use normal random rolls, with no injected position, moves or search delay.
Ignored output directories contain JSON events/checks, screenshots and logcat.

## Limits

This is Android TV emulator evidence, not physical Android TV or Fire OS
qualification. Other ABIs, held keys, accessibility, prolonged play, natural
endgames, emulator promotion, music and character voices remain separate work.
Native audio events are not human listening evidence. Both random outcomes are
controlled in Node tests; an emulator run only demonstrates its observed draws.
Native computation lifetime after disposal has not been measured. Shared/Vega
checks ran, but no Vega device build or runtime test was repeated for this
Android-only change.

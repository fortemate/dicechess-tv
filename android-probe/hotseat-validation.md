# Android hotseat validation — October 28, 2026

## Scope and implementation

The prototype now has a playable two-player screen, opened with **Play with a
friend** in the diagnostic menu. It imports the existing `Board`, `Dice`, `Option`,
`screenReducer`, `useRemoteInput` and canonical game functions. The Android shell
supplies the focus target, limited menu, storage and platform input. No game
rules, shared renderer or Vega implementation were changed, and no dependency
was added. The branch starts from `next` at
`931f346fe7cdabe64f86eb067e9c5fcf58907a6d`.

The menu offers Resume, Resign, Agree a draw, New game and Diagnostics; a finished
game offers New game and Diagnostics. The shared reducer owns movement,
promotion, passing the turn, results and confirmation. The shell normalizes
menu focus after cancellation because the shared menu includes choices that
this slice does not expose.

## Storage and input contracts

The game uses MMKV namespace `dicechess-android-hotseat`, key `game.v1`, separately
from diagnostic snapshots. The stored value is the canonical schema-4 game,
including its starting position, current turn's moves, dice, phase and result.
It is decoded before use and validated before every write. Game transitions
write synchronously before the visible session advances; moving the cursor does
not write. Cursor selection is not saved and is initialized by the shared
reducer on reopening. Invalid data is preserved and reported, without creating
a replacement game. A write failure leaves the session at its preceding state
and shows an error; damaged-save recovery UI is outside this slice.

The focus target adapts completed D-pad releases to down/up pairs for the shared
remote channel. `Pressable.onPress` is the only OK source; native TV select events
are ignored to avoid duplicate actions. Android `BackHandler` calls the consuming
Back channel. The prototype's existing activity gate supplies AppState and
window-focus changes. This qualifies discrete presses on the emulator, not held
keys, repeat timing, accessibility or physical remote behavior.

## Build and device evidence

- Android TV emulator: Android 12 / API 31, ARM64, 1920×1080 at 320 dpi.
- Expo 55.0.32, React Native TV 0.83.10-1 and React Native SVG 15.15.3.
- Node 26.8.2, JDK 17; standalone `assembleRelease` APK, signed with the generated
  debug key for local tests. No Metro server was needed.
- Final APK SHA-256:
  `2884766f2f58829885c369edf80fb2323253d08d4b200a773269fee7bee7fd0f`.
- Inspection of the Android packager source map included the shared board, dice,
  reducer and input hook, and no `@amazon-devices` source paths.

The gameplay script sends actual Android remote key events. Its route helper
uses the existing `boardInput` to plan direction presses; it never injects game
moves, positions or dice. Rolls use the normal runtime random source, reported
as `Math.random` on this emulator, through the shared rejection sampler.

Seven gameplay groups passed:

1. Open the game from diagnostics with native remote focus.
2. Roll normally and play a legal move, leaving a partial turn with dice to spend.
3. Cancel piece selection with Back, pause, cancel replacement, return to
   diagnostics and reopen without changing the game.
4. Press system Home, return and continue using the remote with the same game.
5. Force-stop/relaunch and compare the complete saved game and legal view,
   including position, roll, spent dice, phase and legal actions.
6. Finish the restored turn and make a legal move for the other player.
7. Cancel resignation, confirm resignation, restore the finished result after
   process restart, cancel replacement without losing menu focus, and confirm a
   new game.

Screenshots of the initial board, partial turn, restored turn, continued play,
pause menu and finished result were inspected separately from the event
assertions. The board, dice and menu were visible on this emulator. This is not
cross-platform pixel parity or physical Android TV/Fire OS evidence. The test
finishes a game by resignation; it does not establish every natural endgame,
castling, en passant or promotion flow on a device. Promotion and storage-failure
handling are covered by Node tests, not injected into the emulator run.

The script waits for the diagnostic app's ready event before navigating. An
initial fixed startup delay sent keys too early during a slower cold start;
that was a test synchronization failure, before any gameplay event.

## Checks and reproduction

All 11 existing groups in `scripts/smoke.py` also passed on the final APK,
covering the diagnostic worker, storage, audio events and SVG gallery. Their
reports are under the ignored `build/hotseat-regression-final/` directory.

`mise run check` passed: 337 core, 734 Vega and 13 browser-bench tests, typechecks,
lint, formatting, Metro and browser builds. Android typecheck, lint and 12 tests
passed: the three existing engine/Hermes tests and nine new session/input tests.
The session tests cover partial saves, both players, confirmations, empty-roll
OK guarding, promotion, results, invalid saves, storage failure and single OK
normalization. Workflow syntax and `git diff --check` passed. No Vega device run
was repeated because shared/Vega source was unchanged.

Build and install as described in [README.md](README.md). From `android-probe/`:

```sh
mise exec -- python3 scripts/hotseat-smoke.py --serial <serial>
```

This replaces the probe's hotseat game through the confirmation UI and
force-stops only the probe. Screenshots, event JSON, the saved partial snapshot,
logcat and check results are local ignored files under `build/hotseat-smoke/`
(or the directory supplied with `--output`). The older `scripts/smoke.py` clears
all probe data, including the hotseat save; use it before the gameplay script
when preserving the final gameplay save matters.

Full audio, bots in the playable screen, settings, tutorial, damaged-save
recovery, accessibility, held keys, other ABIs and physical Fire OS testing
remain separate work. This internal test APK is not a store release.

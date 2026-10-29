# Android TV Rolly game validation

This records the first Rolly-only slice. For subsequent opponent and side selection,
see [selection-validation.md](selection-validation.md).

On October 29, 2026, the Android prototype gained a playable game against Rolly.
The player is White; Rolly is Black. The existing canonical `random` mode maps
to the engine's `random-king-capture` algorithm. Additional opponents and side
selection remain future work.

## Implementation and lifetime

`GameScreen` and `gameSession` generalize the previous hotseat screen/session;
the hotseat namespace and `game.v1` key remain unchanged. The bot game uses its
own `dicechess-android-bot` namespace, checked on decode for mode and player side.
Both modes reuse the shared reducer, board, dice, effects and remote adapter.
There are no dependency, lockfile, shared-core or Vega source changes.

The screen owns one existing Android Worklets client. `botDriver` requests a
complete legal path only when needed; `screenReducer` validates it and shows
moves individually at the existing `BOT_STEP_MS` presentation pace. A sentinel
async provider prevents the reducer from falling back to an RN-thread search.
The engine algorithm/work policy is unchanged; presentation delays are not a
search budget.

A menu cancels presentation timers and retains the same-position promise.
Activity gates stop commits during Home/background/blur. A result arriving
while hidden can be retained, but it cannot advance the game until foreground
presentation resumes. The driver checks the synchronous session immediately
before delivery, so a replacement or menu key is safe even before React effect
cleanup. Screen exit disposes the client and invalidates callbacks; it does not
forcibly terminate an already-running native computation.

Every revealed move is saved before publishing or playing its effects. Pending
path entries are not persisted: after process death, the exact saved game/dice
are restored and the worker computes the legal remainder. Worker failures
preserve the saved game and show an error; reopening from diagnostics retries.
New game keeps Rolly/White and requires confirmation. Results use the board and
limited New game/Diagnostics menu rather than exposing unimplemented screens.

## Automated validation

- `mise run check`: 337 core + 734 native + 13 browser tests, types, lint,
  formatting, Metro bundle and browser build passed.
- Android types, lint and 26 tests passed: 1110 tests across all packages.
- The bot test explicitly resolves React from the Android package, like Metro.
  All 26 Android tests also passed in an isolated source copy with only root
  and Android dependencies available, without `native/node_modules`.
- Six new tests cover fixed-side rematch and wrong saves, one-move persistence
  and bot-turn recovery, pending replies behind Home/menu, replacement/unmount
  before cleanup, worker failure without inline fallback, and failed save writes.
- Existing hotseat and effects tests passed with the generalized session.
- Python scripts parsed successfully and `git diff --check` passed.

## Emulator observations

Standalone ARM64 APK on `DiceChessTVProbe`: Android TV Android 12/API 31,
1920 × 1080 at 320 dpi. The release variant uses the generated debug signing key;
no Metro server was needed. APK SHA-256:

```text
df87ae4e9aeecc435ad1412eba81a69639684c6051f7e71c889bd76d4237d0c1
```

All 28 check groups passed on that APK:

1. Eleven original diagnostics: worker correctness/errors/stale replies,
   D-pad and Back during the diagnostic CPU hold, lifecycle, persistence,
   audio and SVG.
2. Eleven hotseat/audio groups: both players' moves, partial-turn restoration,
   menus, Home, result/rematch, playback and interrupted-result cleanup.
3. Six Rolly groups: confirmed start; Back during the bot's move phase;
   exact process-death recovery and Home/return; a legal worker-generated turn
   returning control to White; human partial-turn recovery and a separate
   hotseat save; resignation and canceled/confirmed rematch.

The Rolly run used normal random rolls and real remote events, with no injected
position, dice, moves or artificial delay. It paused after the bot rolled but
before its first move, restored that snapshot after force-stop, then observed
three bot moves and the return to White. Home produced no further saved-game
transitions while away. The result check used resignation, not a naturally
completed game. Diagnostic menu, paused bot, returned human turn and result
screenshots were inspected; all controls and labels fit.

Reproduce after building and installing as described in the README:

```sh
mise exec -- python3 android-probe/scripts/smoke.py --serial <serial> \
  --output android-probe/build/bot-regression
mise exec -- python3 android-probe/scripts/hotseat-smoke.py --serial <serial> \
  --audio --output android-probe/build/bot-hotseat-regression
mise exec -- python3 android-probe/scripts/bot-smoke.py --serial <serial> \
  --output android-probe/build/bot-game
```

Supply `--adb <path>` if needed. The first script clears probe data; the next
two replace their respective game saves through confirmation. Evidence is kept
in these ignored output directories as screenshots, JSON checks/events and
logcat. The bot script reuses the hotseat script's remote helpers without
executing its test scenario on import.

## Limits

The new gameplay run verifies suspension during a pending bot turn. A
controlled unresolved reply in Node tests and the existing diagnostic slow
worker check cover prolonged computation; the normal Rolly search was not
artificially slowed. Partial-bot-turn recovery after one revealed move and
worker/write failures have Node evidence, not fault-injected emulator evidence.

This does not qualify physical Android TV/Fire OS, other ABIs, held keys,
accessibility, prolonged runtime/memory stress, natural endgames, promotion on
the emulator, music, voices or other opponents. Native audio events are not a
human listening assessment. Shared/Vega checks ran, but no Vega device build
or runtime test was repeated for this Android-only change.

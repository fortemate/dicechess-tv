# Android TV gameplay sound validation

On October 29, 2026, the playable two-player Android slice gained sound effects.
It reuses `src/core/cues.ts` to choose effects from committed game transitions
and `native/src/cueFiles.ts` to choose among the existing recordings. No shared
rules, Vega source, dependencies or lockfiles changed.

## Implementation

- The screen creates its effects service after mounting and disposes it on exit
  or a save error. MMKV persistence succeeds before an effect is requested.
  Restoring or replacing a game is silent; cursor and menu navigation do not
  produce game effects.
- The service implements only the effects/lifecycle subset of `Sounds`. Music,
  voices and in-game audio settings are outside this slice. Effects use gain 0.5;
  the TV's media volume controls their output.
- Expo Audio plays separate MP3s with at most one owned player per board, dice
  and result channel. This allows a capture and result to overlap. Native
  completion releases the player; a 10-second fallback bounds stalled decoders.
- The no-move signal waits 500 ms for the dice. A newer game transition cancels
  that delay, even when the newer transition is silent.
- Home, inactive/background, window blur and unmount stop and release players,
  cancel delayed cues and invalidate queued callbacks. Returning permits new
  effects but never replays interrupted or queued effects.
- Audio mode configuration is asynchronous. Effects requested before readiness
  are discarded. Configuration/player failures are logged without advancing or
  replacing a game. Native playback errors without completion are bounded by
  the fallback timeout.
- The existing vendored MP3s, manifests and license notices are hash-checked
  against `native/sounds/sounds.lock.json` before copying. Metro bundles the
  static MP3 references. License notices remain generated sidecars for internal
  handoff; the README supplies visible JDSherbert attribution. No asset rights
  or distribution permission have changed.

## Automated checks

`mise run check` passed: 337 core, 734 native and 13 browser tests, types, lint,
formatting, the Vega Metro bundle and browser build. Android types/lint and all
20 tests passed, including eight new effects tests. Workflow syntax and
`git diff --check` passed. Total: 1104 tests.

The effects tests cover a canonical king capture emitting capture and win
simultaneously, independent channel cleanup, same-channel replacement, stale
callbacks, delayed no-move cancellation, background launch, late configuration,
configuration/player failures, a stalled decoder, silent restoration/replacement,
resignation, and packaged file/license hashes. Existing core tests cover the
remaining game-to-cue classification.

## Android TV emulator

Standalone ARM64 APK, Android TV Android 12/API 31, 1920 × 1080 at 320 dpi.
The generated release variant uses the debug signing key and needs no Metro.

APK SHA-256:

```text
f52f910bc1bf181bab7ff08f9d43feec9b7358ee80c510211dc88c3619f795fc
```

All 11 existing diagnostic groups passed first (worker, storage, lifecycle,
PCM/MP3 audio, parallel playback and SVG). Then all 11 gameplay/audio groups
passed with normal random rolls and real D-pad/OK/Back/Home events:

- Native playing and completion events for two dice rolls and four piece moves.
- Partial-turn save/recovery and continued play by both sides.
- Silent diagnostics reopen, process restoration and restored final result.
- A resignation's `game_win` player reported playing, then Home released it
  before completion. Returning did not request or start it again.
- A new game's agreed draw played `game_draw` to native completion after the
  interruption and process relaunch.
- No effect error or fallback timeout was reported. Screenshots of the partial
  turn and result were inspected; game state and controls remain visible.

Reproduce from the repository root after building and installing the APK:

```sh
mise exec -- python3 android-probe/scripts/smoke.py --serial <serial> \
  --output android-probe/build/sound-regression
mise exec -- python3 android-probe/scripts/hotseat-smoke.py --serial <serial> \
  --audio --output android-probe/build/sound-hotseat
```

Supply `--adb <path>` if adb is not on PATH. The first command clears the probe's
app data. The second replaces its game through confirmation and finishes with
an agreed draw. Evidence stays in those ignored output directories, including
`audio-events.json`, state reports, screenshots and logcat.

## Evidence limits

Native playback/completion and release events establish emulator player
behavior, not a human listening assessment or captured speaker output. Capture
plus win overlap, castling, promotion and no-move timing/cancellation have
code/test evidence; this emulator run observed rolls, ordinary moves and result
jingles. It did not exercise those rarer moves or measure perceived latency.

Physical Android TV/Fire OS, held keys, accessibility, audio focus competition
with other apps, prolonged audio stress, music and voices still need separate
qualification. Vega/shared source is unchanged; the shared checks ran, but no
Vega device build or runtime test was repeated for this Android-only change.

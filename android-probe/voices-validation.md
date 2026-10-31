# Android Voices validation

Voices controls all three hosts, all three opponents and Thinkle's tutorial.
Settings reuses Vega's volume stepping, mute toggle, default level 10 and
3 dB-per-step gain curve. Android reads legacy voice keys until a change writes
one atomic `voices.v1` JSON value in the independent settings store. Failed or
invalid settings are reported without rewriting them or the game snapshot.

The Android speech adapter owns one fresh Expo audio player per spoken clip.
A new line, menu, exit, mute, suspension or disposal cancels its player, delayed
start, completion tail and watchdog. Stale native events cannot advance a
sequence. Tutorial speech advances only after decoder completion plus Vega's
300 ms tail, never from the clip's metadata duration. Configuration, decoder
and timeout failures leave the game usable and do not simulate completion.

A shared late audio handle retains the first tutorial line before the native
service attaches after React's first commit. Initial mute, gain and foreground
state are applied before playback. Effects and voices remain independently
controlled. On return from Home, tutorial speech restarts the current
instruction; canceled gameplay lines are not replayed. Music/ducking remains
separate work.

`useHostVoice`, `useBotVoice`, `useDanger`, `useTutorialVoice`, caption timing
and presentation components come from Vega. Both host and bot caption areas
reserve space while the board is visible, so expiring captions do not shift
the gameplay prompts. Menu screens reclaim that space. The Android game
screen's commentary state remains local to its mounted presentation session.

## Assets and rights

All 446 canonical English recordings and nine original voice-pack licenses are
bundled offline. The generator verifies every copied clip and license against
`native/voices/voices.json`, and generates static Metro references in the
ignored asset directory. The existing licenses allow Fortemate Dice Chess
applications on any platform; they do not grant general reuse rights.
No recordings, transcripts, dependencies or lockfiles are changed.

## Reproduce

Build and install the standalone ARM64 APK as described in README, then run
from the repository root:

```sh
mise exec -- python3 android-probe/scripts/voices-smoke.py \
  --serial <serial> --output android-probe/build/voices
mise exec -- python3 android-probe/scripts/settings-smoke.py \
  --serial <serial> --output android-probe/build/voices-effects
mise exec -- python3 android-probe/scripts/settings-burst-smoke.py \
  --serial <serial> --output android-probe/build/voices-burst
```

Add `--adb <path>` when needed. These suites use real remote events and replace
the disposable probe's games through normal confirmation UI. They inject no
rolls, positions, saved games or preferences. Voice checks use native playback,
completion and release events; they are not a human listening assessment.
The voice suite leaves Voices enabled at level 4 and restores the original
Sounds mute state.

## Automated validation: October 31, 2026

- Android typecheck/lint and all 67 tests passed. New deterministic tests cover
  deferred initialization, decoder completion/tail, duplicate and stale events,
  replacement, mute, stop, disposal, background during initialization/delay,
  timeout/error handling, active gain changes and atomic setting persistence.
- `mise run check` passed: 337 core, 739 native and 13 browser tests plus types,
  lint, formatting, Metro and browser builds. After the final Android caption
  change, native checks and all 739 native tests passed again.
- Native typecheck and both mounted Android regressions passed without Android
  dependencies. Settings regression includes immediate voice-row changes before
  React commits. Existing scripts were adjusted for seven Settings rows.
- ARM64 Android and all configured Vega architectures built. APK SHA-256:
  `91b54a12f138b1a6a01f38af57f66de125e14b37f3515c2822d01d6f3d3e1f45`.

Physical-device playback, human listening, audio focus interruptions that do
not change Activity state, prolonged audio stress, accessibility and held keys
remain separate qualification. Vega runtime was not exercised in this slice.

## Emulator observations

On DiceChessTVProbe (Android TV API 31, ARM64), `voices-smoke.py` passed all
five groups on the final APK: persisted mute/level, exact friend-game recovery,
all three host voices, all three opponent intros, effects-independent speech,
menu cancellation, decoder-driven tutorial sequencing, point replacement,
Home suspension/return, disposal on exit and exact bot-game recovery.
Rolly's host recordings use the canonical legacy `host_` ID prefix; the smoke
uses that prefix rather than inventing a different asset ID.

`settings-smoke.py` passed all four sound/lifecycle/save-preservation groups
with voices enabled. The seven-row rapid-input smoke passed 24 Down and 22 Up
events, immediate value changes and restart recovery, retaining voice settings.
Other adapted full gameplay/tutorial suites were not all rerun in this slice.

All 455 generated voice/notice files matched their pinned bytes inside the
final APK. Settings, host/opponent captions and Thinkle screenshots were
inspected. This is automated native-player/decoder evidence, not human
listening or physical-device evidence.

Local evidence is ignored under `android-probe/build/voices-retry/`,
`android-probe/build/voices-effects/` and `android-probe/build/voices-burst/`.

# Android TV Recovery validation

Android now protects routed screens with Vega's `GameBoundary` and default
Recovery presentation, labels, reducer and remote semantics. An optional
`renderFallback` wrapper lets Android supply `RemoteSurface` after the failed
screen's own provider has unmounted. Vega's default fallback remains available
without that wrapper.

The default choice, Back to the menu, returns home over the current save without
accessing reset storage. Resume game is focused when present. Directions alone
never delete anything. Only OK on Start fresh clears the current slot; the
settings store and both retained legacy namespaces are untouched. The reset
first writes `legacy-skipped.v1` in the current-game namespace, then deletes
`game.v1`. A failed marker write cannot delete the game; a failed deletion keeps
the existing slot available. Home ignores retained legacy import choices after
an explicit successful reset. The saved game is never silently replaced.

If resetting storage fails, Recovery shows a retry message and returns focus
to the preserving choice. Back follows Android's normal exit behavior. The
failed routed screen unmounts, disposing its effects, speech and worker.
App-lifetime music is suspended with no requested theme during Recovery;
foreground changes cannot restart it there. Returning home restores normal
menu music according to the existing preference.

## Reproduce

Build and install the standalone ARM64 APK as described in README, then run:

```sh
mise exec -- python3 android-probe/scripts/recovery-smoke.py \
  --serial <serial> --output android-probe/build/recovery
```

Add `--adb <path>` when needed. The script creates real friend/bot games through
normal replacement confirmations and invokes the explicit engineering link
`dicechess-probe://diagnostics/recovery`. That link throws a real child render
error and changes no saved data by itself. The smoke deliberately selects Start
fresh once on a disposable probe game. No positions, rolls, saves or preferences
are injected. The link is absent from the ordinary menu.

## Automated validation: October 31, 2026

- `mise run check` passed: 337 core, 743 native and 13 browser tests, types,
  lint, formatting, Vega Metro bundle and browser build.
- Android types/lint and all 76 tests passed.
- Four new mounted Android tests cover child disposal, music suspension, default
  preserving recovery, explicit reset, duplicate OK before React commits,
  marker/deletion failures, retry and lifecycle input gating.
- Native typecheck and all six mounted Android regressions passed in the clean
  native CI fixture without Android dependencies.
- The new mounted suite generated LCOV and is included in
  `sonar.javascript.lcov.reportPaths`. Its focused report covers all 149 source
  lines of the shared `Recovery.tsx`; existing Vega recovery tests also passed.
- ARM64 Android and all configured Vega architectures built successfully.
  APK SHA-256:
  `10847a1146359cacb48ea5c0213677877dcd377f44443feaa8531192a45f993d`.

## Android TV emulator observations

On DiceChessTVProbe (Android TV API 31, ARM64), all four Recovery smoke groups
passed using real D-pad/OK/Back/Home input:

1. The fault keeps the process alive, paints a fresh native Recovery surface,
   disposes speech/effects and releases music. Selecting the default choice
   restores the exact friend partial turn, including spent dice; play continues.
2. The bot worker is disposed. Returning home and resuming restores the exact
   bot partial turn, and subsequent human moves work normally.
3. Explicit Start fresh returns home without Resume or a migration chooser,
   preserves every setting and allows a new game. Legacy-store preservation and
   reset ordering also have deterministic test/code evidence.
4. Home/return retains a responsive silent Recovery. Back leaves the activity,
   and a normal cold launch restores the exact saved game.

Recovery and Start fresh selection screenshots were visually inspected. Native
player/service events are automated evidence, not human listening. The test uses
an intentional render failure; it does not validate native crashes or arbitrary
asynchronous callback failures. Existing handled game load/save/worker errors
retain their current messages. Physical remotes, TalkBack, held keys and Vega
runtime remain separate qualification.

The existing Music smoke passed all four regression groups after Recovery,
including persisted mute/volume, ducking, lifecycle release and result timing.

Evidence is ignored under `android-probe/build/recovery/` and
`android-probe/build/recovery-music/`.

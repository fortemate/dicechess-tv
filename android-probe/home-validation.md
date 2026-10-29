# Android TV home menu validation

On October 29, 2026, the prototype gained a home screen for normal play. It opens
without mounting diagnostics or a game. Saved bot and two-player games appear
as separate Continue rows, with completed games labeled View result.

## Implementation

`App` owns the shared activity gate and routes among home, game and diagnostics.
The previous diagnostic application lives in `Diagnostics`; its worker, audio,
SVG and game checks remain available. Each screen still has one native remote
focus target. Home uses the existing `Option` and direction adapter. Game menus
name their actual exit target: Main menu for normal play, Diagnostics for tests.

Home reads both existing MMKV namespaces through the same validated reader as
`gameSession`. It never writes a snapshot. Invalid data stays accessible through
the existing error screen and does not hide the other mode. Continue restores
exactly the saved game. New game uses the shared opponent/side and replacement
flows; cancellation keeps the old snapshot. Starting after a result commits a
new game directly once its required choices are complete. Save failures still
cannot publish a transition or erase the previous snapshot.

No shared core, Vega code, dependencies, lockfiles, game algorithms or asset
provenance changes are involved. `home-smoke.py` drives the normal menu; the
existing suites now enter their original diagnostic screens through home.

## Automated checks

- Android types, lint and 39 tests passed, including eight home/session tests.
- New tests exercise fresh/independent/corrupt/result slots, both New game
  paths, cancellation, confirmed replacement, random color draw timing, and
  first-save/replacement write failures.
- `mise run check` passed: 337 core, 734 native and 13 browser tests, types,
  lint, formatting, Vega Metro bundle and browser build. Total: 1123 tests.
- All 39 Android tests also passed in an isolated source copy with root and
  Android dependencies only, without `native/node_modules`.
- Python scripts parsed successfully and `git diff --check` passed.

## Emulator observations

Standalone ARM64 APK on `DiceChessTVProbe`: Android TV Android 12/API 31,
1920 × 1080 at 320 dpi. The release variant uses the generated debug signing key
and includes its bundle/assets; no Metro server was running. APK SHA-256:

```text
d87271e10d6ca362884190bf5bd31e90842fc6660cfebad4abb58384a191996e
```

All 49 check groups passed:

1. Eleven compatibility diagnostics through the new home entry: worker
   correctness/stale/error paths, remote input during work, lifecycle,
   persistence, audio events and SVG.
2. Eleven normal-home groups: fresh launch and four directions/wrap;
   canceled first bot selection; friend partial-turn continuation and Home/return;
   canceled/confirmed friend replacement; independent bot/friend continuation;
   Back/Cancel from bot replacement; cold-process restoration without mounting
   a game on home; result viewing/rematch; diagnostics return/focus; leaving busy
   diagnostics; and Back exiting the activity followed by relaunch/continuation.
3. Eleven hotseat/audio regression groups, including partial-turn recovery,
   both sides moving, result/rematch and interrupted-result cleanup.
4. Six Rolly lifecycle/persistence/rematch groups.
5. Ten selection groups: all nine opponent/side combinations with remote moves
   and exact process restoration, plus canceled replacement.

The home suite used real D-pad/OK/Back/Home events and normal random rolls. It
played a partial Grabby/Black turn, switched between both independent saves,
and compared the complete saved snapshots after a process restart. A home Back
was also checked against Android's resumed activity, not only an application log.
Fresh, dual-save and result-home screenshots and replacement prompts were
inspected; labels, highlights and controls fit the screen.

All emulator suites used host audio disabled as stated below; playback events
are not evidence of audible output.

## Reproduce

Build and install the standalone ARM64 APK as described in [README.md](README.md).
With Node from mise on PATH, run from the repository root:

```sh
mise exec -- python3 android-probe/scripts/smoke.py --serial <serial> \
  --output android-probe/build/home-diagnostics
mise exec -- python3 android-probe/scripts/home-smoke.py --serial <serial> \
  --output android-probe/build/home-menu
mise exec -- python3 android-probe/scripts/hotseat-smoke.py --serial <serial> \
  --audio --output android-probe/build/home-hotseat
mise exec -- python3 android-probe/scripts/bot-smoke.py --serial <serial> \
  --output android-probe/build/home-bot
mise exec -- python3 android-probe/scripts/selection-smoke.py --serial <serial> \
  --output android-probe/build/home-selection
```

Supply `--adb <path>` if needed. The first script clears only probe data; later
scripts replace games through the UI, without injecting dice or positions.
Home checks require the fresh save slots left by the first suite. The final
selection suite skips its first-launch cancellation check when a bot save exists;
that path is also covered by the home suite. Outputs contain screenshots,
checks/events JSON and logcat in ignored build directories.

## Limits

These are Android TV emulator and Node results, not physical Android TV or
Fire OS qualification. Held keys, accessibility, other ABIs, prolonged play,
settings, music and character voices remain separate work. The emulator uses
`-no-window -gpu swiftshader -feature -Vulkan -no-audio` to avoid the host
CoreAudio stall observed during the preceding slice. Playback/completion events
with host audio disabled are not human listening or host-audio stability evidence.
The Vega package's automated checks run, but its device build/runtime is not
repeated for this Android-only change.

# Android TV Learn to play validation

This records the build before About was enabled. See
[about-validation.md](about-validation.md) for the subsequent integration.
Use the matching revision to reproduce this APK; current smoke scripts follow
the current supported menu.

On October 29, 2026, Learn to play was enabled in the Android home menu after
Play the computer and before Rules reference, following Vega's menu definition.
It renders the existing `TutorialScreen`, lesson reducer and six canonical
lessons through the existing Android `RemoteSurface`. Shared Vega source,
game rules, dependencies and assets are unchanged.

## Save and navigation boundaries

The tutorial owns its lesson state and receives no game store, ledger or worker.
Starting, replaying, completing or leaving a lesson cannot save its position as
the current real game. Home/return preserves the mounted lesson and selection.
Reopening starts at lesson one. After process death the app returns home, where
Resume game restores the real game.

The closing choices retain Vega's behavior: Play Rolly requests a game as White,
Play a friend requests a two-player game, and Main menu starts nothing. The first
two enter the shared `newGame` action. An unfinished current game requires
Cancel/Yes; Cancel or Back preserves it, while Yes persists the new game before
publishing it. Fresh or ended saves start the selected game without selectors.
Exiting or canceling returns to home with Learn to play selected.

## Local checks

- Android types, lint and 46 tests passed. New coverage exercises closing choices
  over fresh, ended and current saves, cancellation in both modes, exact raw
  snapshot preservation, corrupt data and failed writes.
- All 46 Android tests also passed in an isolated source copy with root and
  Android dependencies, without `native/node_modules`.
- `mise run check` passed: 337 core, 734 native and 13 browser tests, types, lint,
  formatting, Vega Metro bundle and browser build. Total: 1130 tests.
- The existing shared tutorial tests cover lesson rules, remote transitions,
  retries, completion choices, save/ledger isolation and input ownership.

## Emulator build

Standalone ARM64 APK on Android TV Android 12/API 31, 1920 × 1080 at 320 dpi.
The release variant uses the generated debug signing key and includes its JS
bundle and assets; no Metro server is needed. APK SHA-256:

```text
af934b3c2e1e5cadfcba497c5041619cb906a9c46d95e179e49dfd6b9b3f2577
```

Ten tutorial-specific groups passed:

1. Opening lessons mounts no game or worker; immediate Back restores Learn to
   play focus and the exact friend save.
2. System Home/return preserves the selected lesson piece. Back deselects first,
   then exits without changing the real game.
3. Process death mid-lesson preserves a real friend partial turn. Reopening
   starts at lesson one.
4. All six lessons match the shared reducer, including a full multi-move turn,
   piece permissions, opening a path, an empty-roll pass, capture retry and king
   capture. All actions use real D-pad/OK/Back input.
5. Closing choices wrap with all four directions; Main menu starts nothing and
   restores the home selection and current game.
6. Play Rolly asks before replacement, with Cancel selected. Cancel retains
   every field of the current friend game.
7. Confirmed Play a friend starts and persists a new two-player game.
8. Confirmed Play Rolly starts the real bot game as White without extra
   opponent/side selectors.
9. Process death during a lesson preserves every field of a current bot partial
   turn too.
10. A full replay and Back from replacement confirmation keep the bot game.

Representative screenshots from every lesson, the missed-capture retry and
closing screen were inspected at the tested viewport. The board, tasks, dice,
selection marks and navigation hints fit without changing the shared layout.

Nine home/menu and six rules regression groups also passed: **25 emulator
groups in total**. These cover the updated home order and focus, fresh-start
cancellation, cross-mode replacement, exact cold restoration, result/rematch,
diagnostic cleanup, all nine rules topics and rules during a real bot turn.
Home was tested with fresh disposable probe data after the tutorial preservation
checks; the tutorial and rules scripts themselves keep app data.

Python scripts parsed, formatting and `git diff --check` passed. The migration
script's expected home order was updated, but the legacy migration suite was not
rerun because migration behavior is unchanged.

## Reproduce

Build and install the standalone APK as described in [README.md](README.md).
With Node from mise on PATH, run from the repository root:

```sh
mise exec -- python3 android-probe/scripts/tutorial-smoke.py --serial <serial> \
  --output android-probe/build/tutorial
```

Supply `--adb <path>` if needed. The suite keeps app data and replaces only the
current probe game through the normal UI. `tutorial-route.mjs` plans keys with
the canonical lesson and board reducers. Every key is sent through Android;
the app's observed state reports must match the plan. No state, moves or rolls
are injected. Lessons themselves use Vega's fixed instructional positions and
rolls. The real games use normal randomness. Screenshots, events and logcat are
saved in the ignored output directory.

## Limits

This is Android TV emulator evidence, not physical Android TV or Fire OS
qualification. Discrete remote presses are tested; held keys, accessibility,
other viewports/ABIs and physical remotes remain separate work. The emulator's
host audio was disabled with the previously documented CoreAudio workaround.

Tutorial voices, character portrait packaging and the first-launch tutorial
offer are not connected in this slice. The shared screen displays Thinkle's
name, lesson text and tasks, reserving the missing portrait's space. The complete
lesson flow works without narration. Settings and About remain hidden.

Vega device validation was not repeated because its source is unchanged; the
shared screen's automated checks ran. No release or deployment was performed.

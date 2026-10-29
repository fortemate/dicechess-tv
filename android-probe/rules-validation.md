# Android TV rules reference validation

On October 29, 2026, Rules reference was enabled in the Android home and game
menus. The implementation renders the existing Vega `RulesScreen`, with the same
nine canonical topics, text, layout and navigation reducer. The underlying Vega
source and game rules are unchanged.

## Implementation

Home exposes the existing shared Rules reference entry after Play the computer.
The game menu exposes the same entry after Main menu. `RemoteSurface` extracts
the game's existing Android bridge: one preferred native focus target forwards
completed direction and OK events plus Back into the shared input channel.
The standalone guide and game use this same bridge.

Opening rules from home does not mount a game or worker. Opening from a game
keeps its session but hands remote input to the guide, preventing double handling.
Back returns to the original menu and Rules reference row. The shared controller
owns that return destination. Navigation never writes a game snapshot.

The bot driver already gates presentation on the board overlay. A reply may
finish computing while rules are shown, but it cannot move pieces or write the
save. Returning to the menu still holds presentation; returning to the board
resumes the same outstanding reply without a second search.

## Local checks

- Android types, lint and 43 tests passed, including both game modes returning
  to the same menu row without a save write, and a late bot reply waiting through
  rules and the return menu before resuming once.
- The existing native screen tests cover nine-topic navigation, wrapping, OK
  remaining in the guide, consuming Back/Menu and held-OK feedback.
- All 43 Android tests also passed in an isolated source copy with root and
  Android dependencies only, without `native/node_modules`.
- `mise run check` passed: 337 core, 734 native and 13 browser tests, types, lint,
  formatting, Vega Metro bundle and browser build. Total: 1127 tests.
- Python scripts parsed and `git diff --check` passed.

## Emulator observations

Standalone ARM64 APK on Android TV Android 12/API 31, 1920 × 1080 at 320 dpi.
The release variant uses the generated debug signing key and includes all JS and
assets, with no Metro server. APK SHA-256:

```text
537223685eacec8bcf695840c6cc1bcaa9bc69bf9562032e96215ece03ffeb66
```

Six rules-specific groups passed:

1. The home entry opens the shared guide without a game. All nine topics are
   reachable with Up/Down, including wrapping in both directions.
2. Left/Right and OK keep the current topic open; subsequent directional input
   still works.
3. System Home/return preserves the selected topic and remote focus. Back
   restores the home Rules reference selection.
4. Rules during a real friend partial turn return to the same in-game menu row;
   returning to the board preserves the entire game snapshot.
5. Process death while reading rules leaves the exact current game resumable
   after cold launch.
6. Rules pause presentation during a real bot turn. Back returns to the focused
   rules row without advancing the game; resuming the board completes the bot
   turn legally.

All nine screenshots were inspected. Topic labels, long explanations, selection
frames and return hints fit the tested viewport. Nine ordinary-menu groups and
11 two-player/audio regression groups also passed: 26 emulator groups in total.
These include cross-mode replacement/cancellation, exact process restoration,
result/rematch, diagnostic entry/cleanup and native effect events.

## Reproduce

Build and install the standalone APK as described in [README.md](README.md).
With Node from mise on PATH, run from the repository root:

```sh
mise exec -- python3 android-probe/scripts/rules-smoke.py --serial <serial> \
  --output android-probe/build/rules-reference
```

Supply `--adb <path>` if needed. The suite uses real D-pad/OK/Back/Home events and
normal dice; it does not inject state or moves. It preserves app data, but
replaces the current probe game through the normal confirmation UI. Screenshot,
event and logcat artifacts are saved in the ignored output directory.

The updated `home-smoke.py` and `hotseat-smoke.py --audio` cover the existing home
and game behavior with the added menu item. The home suite needs fresh probe
data, as documented in the previous menu validation.

## Limits

This is Android TV emulator evidence, not physical Android TV or Fire OS
qualification. Held-key behavior, Android screen-reader output, other viewport
sizes/ABIs and physical remotes remain separate work. Host audio was disabled
with the previously documented emulator workaround; native playback events do
not establish human listening. Learning, settings and About remain hidden.
Vega device validation was not repeated because its source and behavior are
unchanged; its automated checks run with the shared screen tests.

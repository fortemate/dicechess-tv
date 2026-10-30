# Android gameplay settings

Android Settings shares Vega's Highlights, Auto-play only move and Turn board
for friends controls, alongside Sounds. Up/Down selects a row; Left/Right changes
it, OK cycles highlights or toggles a switch, and Back returns home.

Both platforms use `changeGameplaySetting`. Android uses the canonical preference
keys/readers/writers. Each changed preference is written before being published;
failed writes retain the previous value. Settings does not mount a game session
or write the game snapshot. Preferences apply when gameplay opens again.

The board receives the shared highlight style and `flipped(game, turnHotseat)`.
Automatic play uses Vega's `autoChoice`, delay and revision/selection-checked
`auto` action. The activity scheduler pauses in the background and cancels stale
work. Game transitions still save before publication. Tutorial settings remain
separate.

Run `game-settings-smoke.py --serial <serial>` from the repository root with
Python through mise. Like the existing smoke suites, it replaces the current
probe game through normal UI without injecting rolls or positions. It checks
settings after force-stop, exact rolled-game preservation, Black's board
orientation and a naturally reached sole move. It restores gameplay settings
to Standard/off/off at the end. Its screenshots and logs are local evidence.

Physical Android TV/Fire OS, held keys and accessibility qualification are not
covered by an emulator run. No release or deployment is included.

## Validation

- `mise run check` passed: 337 core, 736 native and 13 browser tests, types,
  lint, formatting, native bundle and browser build.
- Android types/lint and 57 tests passed, including failed preference writes,
  exact saved-game preservation, automatic-move persistence and stale-action
  rejection. Total: 1143 automated tests.
- Android ARM64 and Vega builds passed. Shared Vega control behavior is retained
  by extraction and its existing tests; the Vega device suite was not rerun.
- The remote route helper now uses the reported board orientation; the first
  device run exposed its old assumption that only a Black human in bot mode
  could have a flipped board. No game or roll injection is used to correct it.
- On Android TV 12/API 31 at 1920 x 1080, the final APK passed all three
  gameplay-settings smoke groups. D-pad/OK/Back changed and persisted the
  preferences; a saved rolled turn survived a settings visit and force-stop
  exactly; Black's turn rotated the board; and a sole legal move executed
  without game-screen input after enabling auto-play and restarting.
  Settings, flipped-board and automatic-move screenshots were inspected.
  Evidence: `android-probe/build/game-settings-final/`.

The same APK passed all four Sounds regression groups, including Home/return,
mute/volume process recovery and exact friend/bot rolled-turn preservation.
Evidence: `android-probe/build/game-settings-sounds/`.

Initial implementation local debug-signed ARM64 release-variant APK SHA-256:

```text
e8d284fa6eb51e651d46454c02e26a11f07e2c273fbea97ede8780c6aa974478
```

## Rapid-input review fix

The selected Settings row is held synchronously in a ref, with React state
used for rendering. Repeated directions and an immediate value key therefore
use the latest row even before the next React commit.

A mounted-component regression sends repeated keys inside one React `act`
batch. It fails against the original component (the intended Auto-play setting
is not written) and passes with the fix, including wraparound and assertions
that unrelated settings are unchanged. Only storage and the Android focus
wrapper are stubbed; the component and shared remote-input hook are real.

On the Android TV API 31 emulator, `settings-burst-smoke.py` passed 18 Down and
17 Up events with immediate value keys, wraparound, unrelated-value preservation
and force-stop persistence. Android delivers these through a single `input
keyevent` command per burst, without script sleeps between keys. This is separate
from the deterministic pre-render regression and does not qualify physical
remote held-key timing. Evidence: `android-probe/build/settings-burst/`.

Review-fix APK SHA-256:

```text
ad0937d8faa947fb756adb7c77a290faf48b08ca2f10f15feb132b5ae91b31e7
```

JSDoc/docstrings now explain the changed controls, session/persistence contracts
and smoke helpers. CodeRabbit's server-side documentation percentage requires
a fresh review; the previous 20% result describes the previous commit.

The same review-fix APK passed all four Sounds regression groups, including
exact friend/bot rolled-turn preservation and mute/volume process recovery.
Evidence: `android-probe/build/settings-burst-sounds/`. The new mounted-component
regression is included in the native suite and its LCOV report is registered in
`sonar-project.properties`.

Final verification passed: `mise run check`, Android types/lint and all 1144 tests
(337 core, 737 native, 13 browser and 57 Android). The new regression also passed
with Node LCOV instrumentation. Android was rebuilt for this revision; shared
Vega runtime code changed only in documentation, so the prior Vega build/device
evidence remains separate.

## Clean-install regression-test loading

The mounted regression loads the Android component by runtime URL through its
existing host adapters. A literal TypeScript import incorrectly pulled Android's
React Native/MMKV dependencies into the Vega typecheck, whose CI installation
contains only root and native packages. The typed fixture contract stays in the
test; Android's own CI still typechecks the actual component and adapters.

Validation uses a separate tracked-source copy with fresh `npm ci` and
`npm ci --prefix native`, without Android dependencies or copied `node_modules`.
The original test reproduces the missing-Android-module TypeScript failure in
that copy. Application runtime code and the emulator-tested APK are unchanged.

With the fixed loader, that clean macOS copy passed the exact native-board
commands: native typecheck, lint, all 737 tests and Metro bundle. This proves
package isolation locally; the GitHub Linux result is a separate CI check.
No application or emulator behavior changed in this test-loading fix.

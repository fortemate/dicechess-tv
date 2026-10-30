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

Final local debug-signed ARM64 release-variant APK SHA-256:

```text
e8d284fa6eb51e651d46454c02e26a11f07e2c273fbea97ede8780c6aa974478
```

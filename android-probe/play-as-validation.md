# Android Play as validation

Settings exposes Vega's Play as row between Auto-play only move and Turn board
for friends. Left cycles backward; Right or OK cycles forward through Ask,
Random, White and Black. The shared preference reader defaults to Random for
absent/invalid values, and the canonical key is written before publication.

The existing Vega reducer applies the preference after opponent selection:
Ask opens the side menu, while the other choices skip it. Replacing an active
game still requires confirmation with Cancel selected. Resuming a saved game
retains its stored side, position, dice and turn phase. Tutorial closing choices
remain explicit, and a rematch retains the finished game's color preference.

Tests cover the four persisted choices, invalid/default data, failed writes,
seeded Random outcomes for both colors, Ask, exact saved-game preservation and
canceled replacement. Existing tests for manual side menus explicitly request
Ask. Device scripts that require that menu now configure Ask through Settings;
they do not write preferences or game snapshots directly.

Run from the repository root:

```sh
mise exec -- python3 android-probe/scripts/play-as-smoke.py --serial <serial> \
  --output android-probe/build/play-as
```

Use `--adb <path>` when needed. The suite replaces the disposable probe's game
through normal UI, checks every setting after force-stop, checks exact current
White-game preservation and canceled replacements, then starts each kind of
new game. Random's resolved side is checked as valid, not statistically tested
on the emulator; deterministic unit tests cover both outcomes. It finishes with
Play as set to Ask for the existing side-menu suites.

The emulator evidence does not qualify a physical Android TV/Fire OS device,
accessibility or held keys. No release or deployment is included.

## Observed validation: October 30, 2026

- `mise run check`: 337 core, 737 native and 13 browser tests passed, with
  types, lint, formatting, Metro bundle and browser build passing.
- Android typecheck, lint and all 60 tests passed. The ARM64 release APK built
  successfully. Its SHA-256 is
  `cc6c0447982ab77118cbba2911994c4e85cc1e29bbc688169925d64d046c09da`.
- Native typecheck and the mounted Android Settings regression passed in a
  separate root/native dependency installation without Android dependencies.
  The regression also checks navigation immediately followed by a Play as
  value key before React commits.
- The Vega package built for all configured architectures. No Vega Virtual
  Device or physical Fire TV runtime check was performed for this slice.
- On the DiceChessTVProbe Android TV emulator (API 31, ARM64),
  `play-as-smoke.py` passed both groups: all four choices survived force-stop,
  preserved the exact saved White game and canceled replacements, and applied
  correctly to confirmed new games. Screenshots of Settings, Ask and a Black
  game were inspected.
- `settings-smoke.py` passed all four sound/lifecycle/game-preservation groups.
  `settings-burst-smoke.py` passed the five-row navigation/restart regression.
  This is automated playback-event evidence, not a human listening test.

The first Play as run encountered an empty bot roll. The game required OK to
continue, but the existing smoke helper waited for the bot automatically.
The helper now acknowledges empty bot handoffs, and the rerun passed. The
other side-menu smoke scripts were adapted to select Ask, but were not all
rerun in this slice.

Local evidence is in the ignored `android-probe/build/play-as-retry/`,
`android-probe/build/play-as-sound-regression/` and
`android-probe/build/play-as-burst/` directories.

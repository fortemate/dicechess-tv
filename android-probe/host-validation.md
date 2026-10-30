# Android Host for friends validation

Settings exposes Vega's Host for friends choices: Prowla (default), Rolly,
Thinkle and Off. Left cycles backward; Right or OK cycles forward. The
canonical reader, writer, storage key and stepping logic are reused. Preference
writes finish before the new value is published; invalid data reads as Prowla.

Gameplay reads this preference without changing its saved game. Friend games
use `useHostVoice` for the canonical event selection, scripts, shuffled bags,
queue and pacing. The shared `HostBlock`, `Portrait` and `SpeechBubble` render
the chosen host and caption. Space remains reserved while the caption is
hidden so the title, dice and prompt stay in place. Commentary is hidden behind menus, with Off, and
in computer games. This slice supplies no voice callback: it presents text and
portraits without host audio.

The queue and bags belong to the mounted Android game screen. Reopening the
game through home starts a new presentation session, unlike Vega's persistent
game-screen mount. Midgame restoration does not replay a welcome line. The
serialized game, including side, roll and turn phase, is unaffected.

## Reproduce

Install the standalone ARM64 APK as described in README, then run from the
repository root:

```sh
mise exec -- python3 android-probe/scripts/host-smoke.py \
  --serial <serial> --output android-probe/build/host
mise exec -- python3 android-probe/scripts/settings-burst-smoke.py \
  --serial <serial> --output android-probe/build/host-burst
```

Add `--adb <path>` when needed. These suites use real remote events and replace
the disposable probe's games through confirmation UI. They do not inject dice,
positions or settings. The host suite finishes with Prowla selected.

## Automated validation: October 31, 2026

- Android typecheck/lint and all 61 tests passed, including host persistence,
  invalid defaults, reverse/OK cycling, failed writes and exact game recovery.
- `mise run check` passed: 337 core, 738 native and 13 browser tests, types,
  lint, formatting, Metro and browser builds. The mounted Android Settings
  regression covers six-row navigation and immediate host changes before React
  commits. Existing shared host event/pacing/presentation tests also passed.
- ARM64 Android release APK and all configured Vega architectures built.
  APK SHA-256:
  `864a66b6b7e20afb5e61c72c1b221efbac0e68cf432b8d15f23f91e8ce5bded5`.

Physical devices, held keys, accessibility and host voice playback remain
separate work. No Vega runtime or human listening claim follows from these
checks. No new portrait/voice assets or dependencies were added.

## Emulator observations

On DiceChessTVProbe (API 31, ARM64), `host-smoke.py` passed all three groups:
all four choices survived force-stop; changing hosts preserved the exact rolled
friend game; each enabled host displayed its own portrait and caption in a new
game; Off, game menus and computer games displayed no host commentary; and
changing the host also preserved the exact current bot game. Left, Right, OK,
Down and Back were exercised through Settings and game navigation. Settings,
Prowla, Thinkle and Off screenshots were inspected.

The six-row rapid-input smoke also passed: 20 Down and 19 Up events wrapped
correctly, immediate value keys affected the selected row and changes survived
restart. Existing script row counts were updated for the added Settings row;
other full gameplay/tutorial suites were not rerun for this slice.

Local evidence is ignored under `android-probe/build/host-final/` and
`android-probe/build/host-burst/`.

After reserving the caption area, native typecheck/lint and all 739 native tests
passed, including a new mounted presentation regression for expiry, menus,
Off and computer games. Both mounted Android regressions and native typecheck
also passed in an installation without Android dependencies. The full host
smoke passed again on the final APK. The six-row burst run used the preceding
APK; the final change affects only commentary layout.

A separate emulator capture compared the panel before and after a real welcome
caption expired: title, dice and prompt pixels stayed identical. Captures are
in the ignored `android-probe/build/host-layout/` directory.

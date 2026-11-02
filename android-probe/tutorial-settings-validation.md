# Tutorial Highlights and Settings safe area

## Build and scope: November 2, 2026

This follow-up to the [October 31 regression](regression-validation.md) fixes
the tutorial Highlights wiring and standalone Settings layout. It is based on
`next` commit `82e16303b699e3639b635b2d69dc52c7338401c8` with the Android
wrapper changes in this PR. Shared game rules and tutorial reducers are unchanged.

The standalone ARM64 internal test APK has SHA-256
`40efda1e453a106682f2ca0e2f82e25410656eb736970f31b5676d3b64000f12`.
It uses the generated debug signing key, not a distribution key.

Runtime checks use a separate disposable DiceChessTVParity AVD: Android TV
API 31, ARM64, 1920 x 1080 pixels, density 320. The original DiceChessTVProbe
profile and its saved game are not used or modified. The test AVD runs headless
with host audio disabled; screenshots still capture the native Android output.
The first-launch offer is answered with Back/Skip through the normal UI.
Tests create and replace their disposable games through confirmation, never
by injecting storage, positions or rolls.

## Changes and measured results

`LearnToPlay` reads the canonical Highlights preference from the separate
Android settings store on each entry and supplies it to the shared
`TutorialScreen`. Missing or invalid values retain Vega's Standard default;
reading does not repair or rewrite them. The tutorial receives no game store.

The dedicated [smoke test](scripts/tutorial-settings-smoke.py) passed three
assertion groups:

- All eight Settings rows, their descriptions and Back text remain within
  the five-percent safe area. Back restores the selected home row and the
  exact current partial turn remains resumable.
- Each Highlights choice is saved through Settings and survives immediate
  process death. The identical lesson-one state (PPP, selected e2, cursor e4)
  produces four distinct board pixel hashes for Standard, Enhanced,
  Color-blind and High contrast. Screenshots were inspected. Every field of
  the real friend game remains unchanged after each lesson visit.
- Tutorial Back and process death retain the exact bot partial turn and
  the saved High contrast choice.

The existing tutorial suite also passed all 10 groups, covering all six
lessons, background/return, canceled and confirmed replacements, and friend/bot
save recovery. The existing Settings suite passed all four groups, covering
directions/OK/Back, volume/mute persistence, background/return and exact
friend/bot rolled-game preservation. These three suites passed 17 groups in
total; their independent outputs are in `targeted/`, `tutorial/` and `settings/`.

Standalone Settings uses the shared `safeInsets` calculation, removes the
extra footer gap and sets a compact line height without Android font padding.
On this screen the safe rectangle is `(96,54)-(1824,1026)`. The original
Back text node occupied `(112,999)-(1808,1053)`; it now occupies
`(96,978)-(1824,1026)` on six rows and `(96,975)-(1824,1023)` on the two
rows with explanatory text. The Settings title now starts at y=78.
The smoke test measures every nonempty text node in fresh native UI dumps,
not just the footer's visible ink. All rows remain visible together.

Native screenshots, eight UI dumps, exact state comparisons, board hashes
and logs are retained under the ignored `build/parity-fixes/` directory.
The original Settings capture is in `before/`; dedicated checks are in
`targeted/`. The temporary AVD is removed after validation.

## Reproduce

Build and install the APK as in [README](README.md#reproduce), using a
disposable AVD named DiceChessTVParity with the API 31 Android TV ARM64 image
and the Television (1080p) hardware profile. Answer its initial offer with
Skip or Back, then run from the repository root:

```sh
mise exec -- python3 android-probe/scripts/tutorial-settings-smoke.py \
  --adb <adb-path> --serial <serial> \
  --output android-probe/build/parity-fixes/targeted
mise exec -- python3 android-probe/scripts/tutorial-smoke.py \
  --adb <adb-path> --serial <serial> \
  --output android-probe/build/parity-fixes/tutorial
mise exec -- python3 android-probe/scripts/settings-smoke.py \
  --adb <adb-path> --serial <serial> \
  --output android-probe/build/parity-fixes/settings
```

The dedicated test refuses other AVD names and assumes the recorded screen
size and density for pixel and safe-bound checks. All three scripts replace
the current probe game through the normal UI, so use the disposable profile.

## Automated checks and limits

The mounted Android-wrapper test uses the real shared tutorial and board. It
checks every saved Highlights choice through lesson input and reentry, missing
and invalid defaults, the settings-only namespace and absence of writes.
Its LCOV report is registered in Sonar's report list and was generated locally.

Local checks pass: `mise run check` (337 core, 753 native and 13 browser tests,
types, lint, formatting, Vega Metro bundle and browser build), Android
types/lint and all 76 tests. The ARM64 APK and Vega armv7, x86_64 and aarch64
packages build successfully. The later documentation edits pass formatting,
English-only, Sonar report-list and whitespace checks.

These are discrete ADB remote presses and Android emulator measurements.
Mac keyboard input, held keys, TalkBack, other screen sizes/font scales, human
listening and physical TV behavior are not qualified by this change. Vega
was built, but no new Vega runtime comparison was performed. Menu support,
full home/game presentation and game accessibility remain separate work.

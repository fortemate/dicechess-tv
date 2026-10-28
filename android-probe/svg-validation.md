# Android SVG validation — October 28, 2026

## Scope

The isolated Android prototype imports all 12 pieces and three fallback faces
directly from `native/src/`. It renders them with `react-native-svg` 15.15.3,
the version recommended by Expo SDK 55. Metro and TypeScript resolve that module
from the Android package. The shared components, their generators and the Vega
backend are unchanged.

This check starts from `next` at `629073ce8abcde6615c5b328bc3d5adfbfb8b2c0`.
The ninth diagnostic opens the gallery. D-pad selects a cell, OK switches all
artwork between 48 and 114 dp, and Back returns to the diagnostic menu. The
gallery uses one native focus target; it does not implement the game's board
focus or held-key policy.

## Build and emulator

- Android TV emulator: Android 12 / API 31, `arm64-v8a`, 1920×1080 at 320 dpi.
- Expo 55.0.32, React Native TV 0.83.10-1, React 19.2.0; Node 26.8.2 and JDK 17.
- Standalone `assembleRelease` APK, signed with the generated debug key for local
  testing. No Metro server was needed. Only the ARM64 APK was built.
- Tested APK SHA-256:
  `42665675ddef8c41f716a714b2f13f6a0cd1f9de3e30f00bee8ff1e271e7ceae`.

## Observations

All 11 groups in `scripts/smoke.py` passed on the final APK, including the ten
existing worker, storage, lifecycle and audio-event groups. The added group
asserted selection of all 15 components, all four D-pad directions, horizontal
wrap, OK changing 48 → 114 → 48, Back returning to the menu, and immediate OK
reopening the gallery without another direction press.

The script captures `svg-48.png`, `svg-114.png` and `screen.png`. Separate visual
inspection of these final screenshots found all 12 pieces and all three faces
visible at both sizes, with no apparent missing shapes or clipping. The larger
size visibly enlarged the artwork within the same cells. These sizes are Android
logical dp, not a claim of identical physical pixel dimensions across platforms.
The menu screenshot confirmed that all nine actions fit above the footer after
reducing their vertical padding.

The script's assertions establish state and input behavior; they do not compare
pixels. Screenshot inspection is emulator evidence, not pixel parity with Vega
or the browser, and not evidence from a physical Android TV or Fire OS device.
Audio checks observe native completion and interruption events, not listening
quality. Full gameplay, accessibility and held-key behavior remain untested by
this gallery.

## Reproduction and other checks

Use the build/install instructions in [README.md](README.md), then run:

```sh
python3 scripts/smoke.py --serial <serial> --output build/svg-smoke-final
```

This clears only the disposable probe's data. Event JSON, logcat, check results
and screenshots remain under that ignored output directory.

`mise run check` passed: 337 core, 734 Vega and 13 browser-bench tests, typechecks,
lint, formatting, Metro and browser builds. Android typecheck, lint and its three
engine/Hermes tests passed. Workflow syntax and `git diff --check` passed. No
Vega device run was repeated because the changes affect the isolated Android
prototype, its CI triggers and documentation.

The new SVG dependency is MIT-licensed; the shared artwork retains its CC0
provenance. The npm audit still reports the Expo tooling dependency findings
described in the README, with none attributed to `react-native-svg` or its added
dependencies. This is an internal prototype, not a production dependency or
device-support qualification.

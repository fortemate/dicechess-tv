# Dice Chess 1.0.2, build 33

This release improves board readability, clarifies the rules reference and makes Settings easier to use with a TV remote.

## Changes since 1.0.1, build 32

- **Board highlights:** choose Standard, Enhanced, Color-blind or High contrast in Settings. The style is remembered and applies to the game and tutorial. ([#413](https://github.com/fortemate/dicechess-tv/pull/413))
- **Rules reference and tutorial:** clarify maximum dice use, the king-capture exception, en passant through the next turn and the app's draw limits. Thinkle's tutorial line now explains that a king may be left under attack; the matching narration is included. Game rules and castling behavior are unchanged. ([#421](https://github.com/fortemate/dicechess-tv/pull/421))
- **Settings:** group audio, general gameplay and friend-game options; show controls for the focused row. Both switches use Left for off, Right for on and OK to toggle, so repeated directions keep their value stable. ([#428](https://github.com/fortemate/dicechess-tv/pull/428), [#429](https://github.com/fortemate/dicechess-tv/pull/429), [#430](https://github.com/fortemate/dicechess-tv/pull/430))
- **Clearer setting descriptions:** Auto-play only move explains that it plays the sole legal move for you. Play as explains that it selects your color in new computer games. VoiceView receives these explanations on focus and announces only the new value when it changes. ([#430](https://github.com/fortemate/dicechess-tv/pull/430))
- Dependency and documentation updates.

## Downloads

| File                               | Target                                    |
| ---------------------------------- | ----------------------------------------- |
| `dicechess-tv-native_armv7.vpkg`   | Physical Fire TV Stick running Vega OS    |
| `dicechess-tv-native_aarch64.vpkg` | Vega Virtual Device on Apple silicon      |
| `dicechess-tv-native_x86_64.vpkg`  | Vega Virtual Device on Linux or Intel Mac |

The public packages omit the private character portraits. The opponents use their emoji faces; Prowla and Thinkle have no replacement face. This packaging is the same as earlier GitHub releases.

Check downloaded packages against `SHA256SUMS.txt` before installing:

```bash
shasum -a 256 -c SHA256SUMS.txt --ignore-missing
```

Install the package for your device's processor over the existing app to keep its saved game, results and settings. Removing the app deletes those data.

## Validation

Automated checks passed: 334 core, 619 native and 11 browser-bench tests, plus types, lint, formatting, Metro and the browser build. Package and device checks are recorded in [the release preparation record](https://github.com/fortemate/dicechess-tv/blob/v1.0.2%2B33/docs/release-preparation-1.0.2-build33.md).

The owner reported that the Settings changes appeared to work on the physical Stick with the same application code, before this version bump. VoiceView wording is covered by `native/test/voiceView.test.tsx` with AccessibilityInfo stubbed; listening to these new explanations on a physical Stick remains unverified. This GitHub release makes no claim about Amazon Appstore approval or availability.

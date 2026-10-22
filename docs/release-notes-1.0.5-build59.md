# Dice Chess 1.0.5, build 59

## Changes since 1.0.4/build 58

- Add 179 English recordings: 96 lines for Rolly, Grabby and Rampage, and 83 lines for the Hot Seat hosts Rolly, Prowla and Thinkle. Five corrected takes are included; existing recordings remain available. ([#490](https://github.com/fortemate/dicechess-tv/pull/490))
- Give each opponent 13 opening lines, 13 loss lines, eight win lines and seven rematch lines. Starting another game against the same opponent after a result uses the dedicated rematch pool, with immediate repeats excluded.
- Give longer captions more room: opponent bubbles allow four rows and host bubbles three, retaining the existing font size. Host shuffle bags and commentary pacing remain in place.
- Refresh the project's Settings screenshots to match build 58. ([#489](https://github.com/fortemate/dicechess-tv/pull/489))

## Packages

| File                               | Target                                    |
| ---------------------------------- | ----------------------------------------- |
| `dicechess-tv-native_armv7.vpkg`   | Physical Fire TV Stick running Vega OS    |
| `dicechess-tv-native_aarch64.vpkg` | Vega Virtual Device on Apple silicon      |
| `dicechess-tv-native_x86_64.vpkg`  | Vega Virtual Device on Linux or Intel Mac |

Verify downloads against `SHA256SUMS.txt` before installing. The packages contain all 446 voice clips and the ten runtime character portraits, with their existing notices and licenses.

A developer-signed GitHub package can require uninstalling an Amazon-signed store installation, which removes its saved games, results and settings. Preserve the store installation if its data must be retained. Developer-package upgrade checks do not establish preservation through an Amazon-signed store update.

GitHub publication and Amazon Appstore approval are separate. These notes do not announce Appstore availability.

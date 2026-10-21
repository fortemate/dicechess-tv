# Dice Chess 1.0.4, build 55

## Changes since 1.0.3/build 34

- Run computer-opponent searches in a separate Hermes worklet runtime. Requests are serialized and checked against the exact saved turn; late replies cannot change a newer game. A foreground transport deadline offers recovery when a reply takes too long. This addresses long Rampage searches blocking the interactive runtime. It does not make a permanently stuck search reusable without restarting the app. ([#480](https://github.com/fortemate/dicechess-tv/pull/480))
- Create audio players after React's first commit, retain settings and pending startup speech while they initialize, and release effect players while the app is away. Music's periodic ticker stops when its transitions settle; the loop seam retains its timer. These changes do not establish measured startup or CPU improvements. ([#479](https://github.com/fortemate/dicechess-tv/pull/479))
- Pause an opponent's completed move while the app is away, retry a failed music loop seam once, prime effect channels after unmuting, preserve board squares during a turn, and handle menu choices by stable IDs. ([#470](https://github.com/fortemate/dicechess-tv/pull/470))
- Correct the displayed board side when reduced motion changes during a board turn. Improve asset-vendoring checks and device-install error messages. ([#469](https://github.com/fortemate/dicechess-tv/pull/469))
- Update the canonical rules engine to 0.14.9, add regression tests, and refresh the runtime, audio and hardware-validation documentation. ([#447](https://github.com/fortemate/dicechess-tv/pull/447), [#483](https://github.com/fortemate/dicechess-tv/pull/483), [#484](https://github.com/fortemate/dicechess-tv/pull/484))

## Known issue

Thinkle's first-launch greeting can have an unclear or clipped ending to "New to Dice Chess?" on the physical Fire TV Stick. The owner also heard it in store build 30. This release does not claim to fix it; investigation remains tracked in [#482](https://github.com/fortemate/dicechess-tv/issues/482).

## Packages

| File                               | Target                                    |
| ---------------------------------- | ----------------------------------------- |
| `dicechess-tv-native_armv7.vpkg`   | Physical Fire TV Stick running Vega OS    |
| `dicechess-tv-native_aarch64.vpkg` | Vega Virtual Device on Apple silicon      |
| `dicechess-tv-native_x86_64.vpkg`  | Vega Virtual Device on Linux or Intel Mac |

Use the package for your device's processor. All three packages include the ten runtime character portraits and their existing notices. Asset licenses are unchanged.

Verify downloads against `SHA256SUMS.txt` before installing. On the tested Stick, installing a developer-signed GitHub package over the Amazon-signed store version required uninstalling the store app, which removes its saved games, results and settings. Keep the store installation if you need those data. Updating the developer candidate with the final developer package worked without uninstalling and retained MMKV and CRC exactly; preservation through an Amazon-signed store update remains a separate check.

## Validation

Final packages were rebuilt from main `bdf5cf31850e707ecf7d47889622535756ba9b07` with Node 26.8.2 and Vega SDK 0.24.12044. All main Checks, CodeQL and SonarCloud checks passed. The local gate passed 1,046 tests, and metadata, native architecture, portraits, notices and ABI checks passed for all three packages.

The ordinary armv7 package was tested on a physical Fire TV Stick. Eight natural full games used the initial candidate; all 296 application files in each final architecture match it byte-for-byte. After installing the exact final main archive, its package digest and installed JS/Hermes/engine hashes were verified, saved data and CRC survived the developer update unchanged, and one more full Rampage game was completed. The nine games cover both human sides against every bot and two automated Hot Seat sessions with different hosts.

Settings, six tutorial lessons, nine Rules topics, About, cold saved-game recovery, 5/30/180-second Home returns and two separately counted saved-position replays also passed. The new test profile was restored byte-for-byte and the final app left closed. Human TV listening, a two-human session and an Amazon-signed upgrade are not claimed. See the [release preparation record](release-preparation-1.0.4-build55.md) for hashes, exact scope and logging limits. This GitHub preparation makes no claim about Amazon Appstore submission, approval or availability.

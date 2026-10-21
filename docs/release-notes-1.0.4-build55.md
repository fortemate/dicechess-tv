# Dice Chess 1.0.4, build 55

Prepared release notes. The packages have not been published, and no Amazon Appstore submission is part of this preparation.

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

Verify downloads against `SHA256SUMS.txt` before installing. Upgrade without uninstalling to retain saved data, where the device accepts the package's signing identity. Amazon-signed store upgrades require separate validation.

## Validation and publication

See the [release preparation record](release-preparation-1.0.4-build55.md) for exact package checks, physical-device results and remaining work. Earlier checks for #479 and #480 remain evidence for their own commits and QA packages; they are not a physical test of this new release candidate.

After the owner merges the version PR, rebuild from that exact main commit before creating the signed `v1.0.4+55` tag and publishing the GitHub assets. Do not submit to Amazon Appstore as part of this GitHub release preparation.

# Dice Chess 1.0.3, build 34: GitHub release preparation

Prepared on October 18, 2026, from main `471cc1fc38e2ff7822d07ddc7d327a443e6c443f`, following the published `v1.0.2+33`. The proposed tag is `v1.0.3+34`. The manifest version is raised to 1.0.3; the planned build number is 34.

This is a preparation record. Publication requires the owner's PR merge, a final build from the merged main commit, an unused signed tag and a GitHub upload. The [release notes](release-notes-1.0.3-build34.md) are prepared for that step.

## Scope

- Include the en-US copy changes from #433 and the deterministic Thinkle caption test from #434.
- Track portrait pack 1.4.1, unchanged from the commit and digests in `native/portraits/portraits.lock.json`, together with its original `NOTICE.txt`.
- Build all three GitHub packages with the same ten runtime portraits as the armv7 Appstore package. Thinkle's SVG generates the splash but is not included as a runtime asset.
- Make the real-pack tests mandatory in CI and check every pinned source image, the splash vector and the notice.
- Update setup, licensing and packaging documentation for a normal clone that includes portraits. The existing asset-license terms remain unchanged.

## Validation

- `mise run check` passed: 334 core, 624 native and 11 browser-bench tests, 969 total, with no skipped tests; types, lint, formatting, whitespace, Metro and the browser build passed.
- The site build passed for 31 pages, including its search index and friction-log check.
- All 17 vendored portrait files and the original notice match the pinned source bytes and published digests. Git attributes and formatter exclusions preserve these bytes.
- A clean Vega SDK 0.24 Release build on Node 26.8.2 produced armv7, aarch64 and x86_64 candidates. Every archive reports version 1.0.3/build 34, has the correct native-library architecture and contains exactly ten runtime portrait PNGs. Unused source portraits and Thinkle's SVG are excluded from runtime assets.
- `SHA256SUMS.txt` verifies all three candidates. JavaScript and Hermes bundles match across architectures and match the ordinary Release build of `471cc1f` checked on the physical Stick. Bundled license notices passed their source-map check.

| Candidate                          | SHA-256                                                            |
| ---------------------------------- | ------------------------------------------------------------------ |
| `dicechess-tv-native_aarch64.vpkg` | `df7cf5628d7e096fcf7e948887c88e84e92a0f011ade875a4bc964f55ab36df6` |
| `dicechess-tv-native_armv7.vpkg`   | `d0e967cdf58542d60fdded6bda5eb66200f70ff8a4f7dcd6e2cdc075aa341f00` |
| `dicechess-tv-native_x86_64.vpkg`  | `5bad3d38a96177120687a96813f73fac892b17d0b751cf8470a6cf99bf17d1f4` |

## Vega Virtual Device

The aarch64 candidate was installed over 1.0.2/build 33 without uninstalling. Installed version/build metadata and JavaScript/Hermes hashes match the candidate. MMKV saved data and CRC remained byte-identical immediately after upgrade and launch.

D-pad, OK and Back navigation opened the opponent chooser and moved focus across its three portrait cards, then opened the first tutorial lesson with Thinkle's portrait. The captured opponent and tutorial screens passed the outer-5% safe-area check. These are Virtual Device checks; the armv7 and x86_64 candidates have been verified as packages, not installed on those target processors during this preparation.

## Physical owner feedback

Main `471cc1f` passed all main-branch Checks, CodeQL and SonarCloud checks before packaging. Its ordinary Release armv7 package, version 1.0.2/build 33 with portraits, was installed and launched on the physical Fire TV Stick. Deployed JavaScript and Hermes bundles matched the archive. MMKV saved data and CRC were byte-identical before and after the upgrade, and the system crash history was unchanged during launch. A screenshot showed the home screen. The owner then reported that the app appeared to work.

This is physical feedback on the application code preceding this version bump. It does not establish physical validation of the 1.0.3/build 34 package, physical VoiceView listening or a new sustained-gameplay run.

## Publication and visibility handoff

Rebuild the packages from final merged main before publication; candidate hashes identify the preparation only. Publish all three packages and `SHA256SUMS.txt` on `v1.0.3+34`, after verifying that build 34 has not been used by a later upload. Verify the published downloads afterward.

Repository visibility and licensing are separate owner actions. See the [repository transition handoff](repository-visibility-transition.md). No tag, release, Appstore submission or visibility change is part of this preparation.

# Dice Chess 1.0.2, build 33: GitHub release preparation

Prepared on October 18, 2026 from candidate commit `07341e22b694eec483a00b4ec6fc7daabb6f54a9`. Its executable application source matches merged main `d61188af83c4e573525293ba064b71461a44058b` ([PR #430](https://github.com/fortemate/dicechess-tv/pull/430)); the manifest version is raised from 1.0.1 to 1.0.2. The proposed tag is `v1.0.2+33`, following the published `v1.0.1+32`.

This is a preparation record. Publication is pending the owner's version-PR merge, final-main build, signed tag and GitHub upload, as [CONTRIBUTING.md](../CONTRIBUTING.md#releases) requires. The [release notes](release-notes-1.0.2-build33.md) are prepared for that step.

## Automated checks and packages

- `mise run check` passed: 334 core, 619 native and 11 browser-bench tests, 964 total, with no skipped tests. Types, lint, formatting, whitespace, Metro, bundled notices and the browser build passed.
- A clean Vega SDK 0.24 Release build produced armv7, aarch64 and x86_64 packages. All three archives report version 1.0.2/build 33 in their build metadata and version 1.0.2 in their manifest; their native-library architecture matches their filename.
- The private portraits and previous build directory were moved aside before the public build. Every public archive contains zero portrait files. The local portrait pack was restored afterward. The public splash was regenerated without the portraits; About selected the credits for both pieces and opponent faces when the missing portrait failed to load.
- `SHA256SUMS.txt` covers the three candidate packages and passes verification. JavaScript and Hermes bundles match across all three architectures and the ordinary build of `d61188a` previously installed on the physical Stick. No diagnostic application fixture was introduced.
- Comparing the public armv7 candidate with that earlier portrait-equipped armv7 package found 282 identical application files, including the audio, code and native library. The differences are the manifest version, generated asset index and public splash, with the ten portraits removed.

| Public candidate                   | SHA-256                                                            |
| ---------------------------------- | ------------------------------------------------------------------ |
| `dicechess-tv-native_aarch64.vpkg` | `111bb83a2bd85d255f6694d011ae7adfbad8effaba9cdce7b3b4cb432ec92b9a` |
| `dicechess-tv-native_armv7.vpkg`   | `f54f94c643b8963012fe4cd2775335adcd994f7a0ad1ed2da578ac802eac3c23` |
| `dicechess-tv-native_x86_64.vpkg`  | `012b879843653ce75382790c1e830a724eaae55be8ab716266f0588a3c42dd26` |

## Vega Virtual Device

The public aarch64 candidate was installed over 1.0.1/build 32 without uninstalling. Installed version/build metadata and JavaScript/Hermes hashes match the candidate archive. MMKV data and CRC remained byte-identical immediately after upgrade and launch, before the subsequent UI checks.

Using D-pad, OK, Back and Menu at 1920x1080:

- Opened Settings, cycled all four Highlights values and restored Standard. Checked repeated Right/Left on Auto-play only move, the pressed state while OK was held, its release and the focused Play as explanation. Restored the initial option values.
- Inspected the maximal-dice-use, en passant and app-draw topics in Rules reference and returned with Back.
- Opened the first tutorial lesson, the opponent chooser and About. The public opponent chooser showed the three emoji faces, Thinkle's tutorial had no portrait, and About credited both pieces and opponent faces to RhosGFX.
- The captured screens passed the outer-5% safe-area check. System crash history was unchanged during the upgrade and these checks.

These are Virtual Device checks. The armv7 and x86_64 candidates were verified as packages; they were not installed on those target processors during this preparation.

## Physical owner feedback and limits

Before this version bump, the ordinary armv7 build of `d61188a`, numbered 1.0.1/build 32 and carrying the private portraits, was installed and launched on the physical Fire TV Stick. Its deployed JavaScript/Hermes bundles matched the built archive, saved data and CRC remained byte-identical, and launch added no crash record. The owner then reported that the Settings changes appeared to work.

That is feedback on the same application code with different packaging and version metadata. It is not a physical installation check of the public 1.0.2/build 33 candidate. VoiceView wording is checked by `native/test/voiceView.test.tsx` with AccessibilityInfo stubbed; listening to the new explanations on a physical Stick remains unverified. No new sustained-gameplay or per-cue listening run was performed for this version-only candidate.

The three public packages, checksum manifest, release notes and owner handoff are prepared locally. No release tag, GitHub release, release-asset upload or Appstore action was executed as part of this preparation. Rebuild the public set from the final merged main commit before the owner publishes it; the candidate hashes above identify this preparation, rather than a future published download.

# Dice Chess 1.0.1, build 30: release validation

Prepared on October 14, 2026 from `9ef91358d1033b6599b71920bb39baf96a9bcff2`, on the version branch in [PR #383](https://github.com/fortemate/dicechess-tv/pull/383). Its application source matches merged main `ca802a97c10c31652642c77d97e1ea5364d7bd20` ([PR #388](https://github.com/fortemate/dicechess-tv/pull/388)); the manifest version is 1.0.1. The candidate uses build number 30 and engine 0.14.7.

The following sections record the candidate's preparation and device checks. Final-main packaging, owner feedback and publication are recorded separately below, following the release steps in [CONTRIBUTING.md](../CONTRIBUTING.md#releases).

## Automated and package checks

- `mise run check` passed in full: 325 core, 586 native and 8 browser tests, 919 total, plus types, lint, formatting, whitespace checks, Metro and the browser build. Metro's first attempt hit stale Watchman metadata; refreshing the checkout's index made the retry pass.
- The Vega SDK 0.24 Release build passed for armv7, aarch64 and x86_64, including the bundled-notices check. Source and private portrait digests were verified by the asset generator.
- The private armv7 Appstore package and the aarch64 QA package contain ten portraits each. The public packages for all three architectures contain zero. Each reports version 1.0.1/build 30; package processors and SHA-256 manifests were checked.
- JS and Hermes bundle digests match between the private and public sets. No diagnostic application fixture was built into these packages. The installed Stick and VVD bundles match the candidate archives.
- CI and CodeQL passed on the built commit `9ef9135`, and Sonar reported zero new issues. CodeRabbit's green status said automatic review was skipped; it is not evidence of an additional code review. The version PR changes no executable application code.

## Upgrade and saved-position regression

The ordinary Release candidate was installed over version 1.0.0/build 29 on both a physical Fire TV Stick 4K Select (armv7, Vega OS build `2602000051520`) and a Vega Virtual Device (aarch64). Neither device was uninstalled. Each device's MMKV data and CRC remained byte-identical after the upgrade, preserving the original game, ledger and settings.

The exact saved position from the earlier physical ANR in [#261](https://github.com/fortemate/dicechess-tv/issues/261) was restored temporarily on both devices:

```text
rnB1k3/p1pp1ppN/7r/4p3/1b5q/8/PPPPPn1p/RNBQ1KR1 b - - 1 6 RPQ
```

Aggressive mode, human White, turn 12, revision 49, dice `[4, 1, 5]`, no actions played from this roll. Resume through the real remote input completed the search and applied `h2g1q`, then `g1f1`. Both devices reached king-captured at revision 51. No CPU profiler, substituted bot algorithm or diagnostic application code was used.

The earlier failure used engine 0.14.5. The current search is still on the JavaScript thread, deferred by a macrotask in #385; off-thread work remains tracked in #260. These observations establish the tested position and runs, not a guarantee for every search position.

## Sustained play

The app ran with effects, voices and music enabled. A script drove short D-pad and OK presses through the native input driver, reading committed game snapshots and comparing system crash history before and after each run. Games were rematched after completion. No profiler or modified application was used.

| Device         | Mode          | Elapsed seconds | Remote presses | Completed games | New crashes |
| -------------- | ------------- | --------------: | -------------: | --------------: | ----------: |
| Physical Stick | Rampage       |          602.97 |            238 |               2 |           0 |
| Physical Stick | Play a friend |          602.06 |            244 |               1 |           0 |
| VVD            | Rampage       |          602.15 |            279 |               5 |           0 |
| VVD            | Play a friend |          602.66 |            291 |               1 |           0 |

Rolly and Grabby were also exercised in short runs on both devices, with game commits and unchanged crash history:

| Device         | Opponent | Elapsed seconds | Remote presses | New crashes |
| -------------- | -------- | --------------: | -------------: | ----------: |
| Physical Stick | Rolly    |           91.97 |             28 |           0 |
| Physical Stick | Grabby   |           93.18 |             22 |           0 |
| VVD            | Rolly    |           91.15 |             32 |           0 |
| VVD            | Grabby   |           94.28 |             26 |           0 |

## Settings, Home and secondary screens

On both devices, the real remote opened in-game Settings, independently toggled music, effects and voices, and restored their previous values. The persisted values were read after each change. Home and a cold relaunch kept the same game, dice and phase; in this run both rolls had no playable action and waited at the handoff. Resume, About, Rules reference and Back were exercised, with screenshots of the secondary screens inspected.

After validation, the original owner data and CRC were restored on each device and compared byte for byte after a cold launch. Both devices retain the ordinary candidate 1.0.1/build 30, with deployed JS/Hermes bundle digests matching the archives and unchanged system crash history.

## Scope and owner QA

The [audio validation record](audio-regression-validation-387.md) covers the earlier 14 October playback probes, music-failure scenarios, all six tutorial lessons and lifecycle/settings checks of the same application code. Those runs are separate from this candidate's upgrade and sustained-play checks.

Technical completion and cleanup events do not prove that every cue and line was audible on a television. The preparation run left owner listening and the remaining scenarios in [Playtesting](playtest.md#release-candidate-checks-on-a-fire-tv-stick) for final QA. The owner's subsequent report is recorded below; it does not add a per-cue listening checklist. The device logs contain SDK SVG/view lifecycle messages and media-metrics service unbind errors; this record does not describe a zero-error log.

The package sets and release notes were prepared locally. No tag, GitHub release or Appstore upload was executed as part of this preparation. A Developer Console read then showed an existing submission draft marked Ready to Submit with build 28 uploaded; it did not establish store publication. Its Live App Testing metadata was not available in that session. This was the preparation-time snapshot, before the subsequent owner report below.

## Final-main packaging and publication

After PR #383 merged on October 14, 2026, both package sets were rebuilt cleanly from final main commit `5a8bc325397fb95598843f77301d51e907fada0b`, with version 1.0.1 and build number 30. The build used Vega SDK 0.24.12044, Vega CLI 1.4.2 and Node 26.8.2; bundled-notices checks passed. The main tree matches merged PR head `a7934168974f3d04d720edf492364956cdb19fba`.

Every application file under `assets/`, `bundle/` and `lib/`, plus `manifest.toml`, was compared with its corresponding candidate package from `9ef91358d1033b6599b71920bb39baf96a9bcff2`. All match byte for byte, including JS/Hermes bundles, native libraries, audio, music catalogs and license notices. The final private armv7 Appstore package contains ten portraits; the three public packages contain zero. The final rebuild was not separately installed on either device: the device checks above remain checks of the candidate with the identical application payload.

The owner reported checking the Stick on October 14, 2026 and finding everything working well. The owner then reported submitting the application to the Amazon Appstore for publication. This records the owner's submission report; there was no independent Console readback during the GitHub release step, and store approval or availability has not been confirmed.

[Dice Chess 1.0.1, build 30](https://github.com/fortemate/dicechess-tv/releases/tag/v1.0.1%2B30) was published on GitHub on October 14, 2026 at 19:14:10 UTC and marked Latest. The signed annotated tag `v1.0.1+30` has tag object `b85371c88a1d7147b6c16cb9fc392722eeec2164` and resolves on the remote to the exact built commit `5a8bc325397fb95598843f77301d51e907fada0b`; its SSH signature passed verification. The release is neither a draft nor a prerelease.

All four public assets were read back and downloaded from the published release. Their SHA-256 digests match the local final files and the published `SHA256SUMS.txt`. The downloaded packages also report version 1.0.1 and build 30, with zero portraits. The private Appstore package was not uploaded to GitHub.

| Public package                     | SHA-256                                                            |
| ---------------------------------- | ------------------------------------------------------------------ |
| `dicechess-tv-native_aarch64.vpkg` | `32e8cc7576c19025c7c4808b378796a9f928558a52cbecf3aef82f34a743549d` |
| `dicechess-tv-native_armv7.vpkg`   | `58a0b79b8a5b170d8a144cd49ec4079b4577d5deeeaa9a5516c65a43f395c7de` |
| `dicechess-tv-native_x86_64.vpkg`  | `90d015af5776c531a53d4f08a7ab6cae6fa43f781e7d091a516394edf1028694` |

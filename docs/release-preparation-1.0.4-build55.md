# Dice Chess 1.0.4, build 55: GitHub release preparation

Prepared on October 21, 2026, following `v1.0.3+34`. The version PR [#486](https://github.com/fortemate/dicechess-tv/pull/486) was merged as `bdf5cf31850e707ecf7d47889622535756ba9b07`. All three final packages were rebuilt from that exact main commit. The proposed tag is `v1.0.4+55`; build 55 also exceeds the local QA builds through 54.

The [release notes](release-notes-1.0.4-build55.md) describe the changes since build 34 and the remaining Thinkle greeting issue, #482. No tag, GitHub release or Amazon Appstore submission was created by this preparation task.

## Local and CI validation

- Fresh root, native and web dependencies were installed with `npm ci` using Node 26.8.2.
- `mise run check` passed: 335 core, 698 native and 13 browser-bench tests, 1,046 total, with no failures or skips. Type checks, lint, formatting, Metro, the browser build and whitespace checks passed.
- A clean Vega SDK 0.24.12044 Release build produced armv7, aarch64 and x86_64 packages. The original package identity, `com.fortemate.dicechesstv`, was retained. No runtime probes, injected response delays or QA identity changes were used.
- Manifests, build metadata and `vpt info` agree on version 1.0.4 and build 55. ELF headers identify ARM, AArch64 and x86-64 libraries in the respective archives. Every package contains exactly ten runtime portrait PNGs and the license notices; unused source portraits and the splash SVG are excluded.
- JavaScript, Hermes, the opponent engine bundle and generated third-party notices match across architectures. Bundled-notice validation and SDK manifest/ABI validation passed for every final package.
- Checks, CodeQL and SonarCloud passed on the exact merged main commit. The [main Checks run](https://github.com/fortemate/dicechess-tv/actions/runs/39625748562) records the gate.

## Candidate and final package identity

The initial ordinary candidate was based on main `a6f86b44989c9e1b84a3ab3bd6481adfe12e4851` with the manifest raised to 1.0.4 in the version PR. Eight full physical games and the controlled regression replays used this candidate. After the owner merged #486, a clean rebuild of main `bdf5cf3` produced the final archives below. All 296 application files in each architecture, including the manifest, native library, JavaScript, Hermes, opponent engine and assets, match the candidate byte-for-byte. The comparison excludes `meta-info/`; the package envelopes and archive hashes differ.

| Initial candidate                  | SHA-256                                                            |
| ---------------------------------- | ------------------------------------------------------------------ |
| `dicechess-tv-native_armv7.vpkg`   | `5a4825243d627499d9ac8d828ff4441445139a63d5307deed1786313fceadd6c` |
| `dicechess-tv-native_aarch64.vpkg` | `6e809ef91f04f1d1717387189692bc1c2ed23add813c486a590c5e65c4181e05` |
| `dicechess-tv-native_x86_64.vpkg`  | `99ce2629093e2b20b21233265d880ab678f092f9bda0bce74ebd6a48e02653cc` |

| Final main package                 | SHA-256                                                            |
| ---------------------------------- | ------------------------------------------------------------------ |
| `dicechess-tv-native_armv7.vpkg`   | `5f5917e26de43df4c61e1889f929b18b4be1e4ed0f1229d6866329a3b991436f` |
| `dicechess-tv-native_aarch64.vpkg` | `13785c4082bb6625cfa0a919690f518294f294239e7b3fff15cbf691753faf73` |
| `dicechess-tv-native_x86_64.vpkg`  | `ba56203f9e900f2fb31827f9f0f3e01f975ef15da709b3b30d77269a1f512183` |

The final armv7 archive was then installed on the Stick without uninstalling the developer candidate. The installed package digest matched `vpt checksum` of the final archive; installed JavaScript, Hermes and opponent engine hashes matched as well. MMKV data and CRC were byte-identical before the update and after launch. One additional natural full Rampage game was completed on this exact final archive.

## Physical Fire TV Stick

Testing used a physical armv7 Fire TV Stick with automated D-pad, OK and Back events through `inputd-cli`. The packages were ordinary Release builds with the original application registration. No emulator or modified diagnostic runtime is counted as physical evidence.

Nine games were started through the normal UI and reached natural king-capture results:

| Mode     | Full games | Automated human side or host                                 |
| -------- | ---------: | ------------------------------------------------------------ |
| Rampage  |          3 | White and Black on the candidate; White on the final archive |
| Grabby   |          2 | White and Black                                              |
| Rolly    |          2 | White and Black                                              |
| Hot Seat |          2 | Both sides automated; Prowla and Thinkle as hosts            |

The long Rolly game crossed the input driver's 25-minute time window. It continued with the same game ID and retained its complete sample prefix. A cold restart at turn 94 preserved the exact saved handoff, including all three used dice; the natural result followed at turn 98. It is counted once. Controlled positions, tutorial actions and unfinished games are excluded from the nine-game total.

Additional checks passed:

- All audio levels 1–10, off, boundary clamping and mute/unmute; every highlights, auto-play, side, board-turn and host option; settings persisted after a cold launch.
- All six tutorial lessons, all nine Rules topics and About, using remote keys.
- Three cold launches and a saved-game cold resume. Home intervals of 5, 30 and 180 seconds each returned in the same process with the exact saved game.
- A controlled heavy-position replay observed a pending opponent request before Back. Menu opened at the original saved revision, held that save while open, and legal play continued after returning. A second historical replay completed a legal king capture. These replays changed test saved data only, not runtime code. The heavy board was originally transcribed from a store screenshot; hidden state such as castling rights was an assumption, not an exported store snapshot.
- After testing the final archive, the new empty build 55 profile was restored. Three repeated clean-profile launches displayed the tutorial offer and retained byte-identical MMKV and CRC files. The app was left closed on the final ordinary build. The separate QA package was not updated.

No new crash-history entries appeared. No uncaught JS exception or native crash pattern was found in the covered application stream. SDK warnings containing `FATAL: No component view manager` and media IPC teardown errors remain in the logs; the same warning existed in earlier QA runs and did not terminate the process here. This is not a claim of completely clean logs.

## Store signing and evidence limits

The installed Amazon-signed 1.0.1/build 30 refused the developer package with `Uninstall existing package to update`, and developer-shell export of its saved data was denied. The physical test therefore used a clean developer installation after the owner approved removing the store package and its data. Original store saves were not restored. The byte-exact restoration above refers only to the new build 55 profile; the later upgrade check was between two developer packages.

Human TV listening, a two-human session, measured remote-key latency and an Amazon-signed in-place upgrade are not established by this run. Aarch64 and x86_64 passed package and ABI checks but were not launched during this preparation. Startup speed and CPU savings were not measured. Thinkle's clipped first greeting remains tracked in [#482](https://github.com/fortemate/dicechess-tv/issues/482).

System logs were collected before installation. The separate application namespace stream began at 15:37:45 UTC and covered the tutorial, lifecycle checks, all full games, controlled replays and final archive checks. The initial launch and early audio-level checks have UI/state, system-event and crash-history evidence, without a continuous application stream. The three final clean-profile launches were logged.

## Owner publication handoff

The final archives and `SHA256SUMS.txt` identify main `bdf5cf31850e707ecf7d47889622535756ba9b07`; keep their provenance with the release. The owner checks that the proposed tag/build is still unused, creates the signed tag and publishes all three packages plus the checksum manifest to GitHub. Verify the uploaded downloads afterward. If choosing a newer source commit, rebuild from that exact commit and compare its application payload with the tested set.

Do not publish or submit to Amazon Appstore in this task. Recheck the latest submitted build number and validate the Amazon-signed update separately before a later Appstore submission.

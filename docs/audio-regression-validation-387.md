# Audio regression validation (#387)

Validated on October 14, 2026, against main `7035ffc` and the audio playback lifecycle changes in this pull request.

## Automated checks

`mise run check` passed: 325 core tests, 586 native tests and 8 browser tests, types, lint, formatting, the Metro bundle and browser build. The native suite adds 33 regression tests. Focused audio coverage is 98.12% of lines and 87.44% of branches. `mise run build` produced Release packages for armv7, aarch64 and x86_64 with SDK 0.24.12044.

The new regressions cover delayed playback, native completion and errors, missing completion/initialization events, stale events after replacement or Home, end-of-stream cleanup, failed music transitions and loops, explicit retry, readiness without metadata, and tag removal after verification of vendor hashes.

Decoded PCM SHA-256 matched for all 272 original and packaged MP3s. ID3 stripping changes metadata only; vendor files, source locks, credits and licenses remain intact.

## Device method

VVD ran the aarch64 Release package. Hardware ran the armv7 Release package on a Fire TV Stick 4K Select, OS build `2602000051520` (OS 2.0). Temporary native wrappers logged playback positions, duration, native `ended`/`error`, release completion and rendered UI state. They exercised the production audio modules and real application respectively. The wrappers were removed from the final application package.

VVD also supplied a recording with audio. Hardware evidence comes from native playback events, positions, renderer logs, UI state and screenshots; no hardware audio recording or direct listening was available. These are separate evidence sources.

## Playback probe

The 600-second probe passed independently on both devices. It requested 84 spoken clips across bot, host and tutor packs, exercised all ten effect cues, changed between all four music roles, toggled music, forced repeated EOF cleanup with delayed ticks, injected a missing music file and retried a working catalog.

Each run completed 108 player releases, including 90 releases after native EOF. At the end only the three reusable effect channels remained initialized. The maximum EOF release time was 186 ms on hardware and 314 ms on VVD. There were no unexpected playback errors, completion watchdogs, native deinitialization timeouts or ANRs. The missing-file test produced one expected failure on each device: a native error on VVD and the no-progress timeout on hardware. The previous music continued until the explicit retry started the working theme.

An earlier independent 600-second pass with the same normalized audio and startup sequence also passed on both devices. VVD audio was recorded during the probe; the hardware result is based on its own native events and positions.

## Application navigation

All six tutorial lessons were completed on each device using D-pad and OK, returning through the closing Main menu choice. Each run completed all 45 tutorial clips at native EOF, without a premature release. Real menu music looped during the tutorial.

Music off/on and volume Left/Right, effects off/on, voices off/on, a muted game start and roll, and enabled game cues were exercised through Settings and Back. Home during speech silenced and released the current voice and music. Hardware interrupted the tutor at 0.842 s of a 2.064 s clip and released the voice in 197 ms. VVD separately exercised interruption during a spoken clip.

On this OS, Home causes the system to terminate the background process. Relaunch restored the game turn, pending phase, dice and last move on both devices. Hardware retained turn 3 in move phase with its pending dice; VVD retained turn 2 in move phase after a move, with its remaining dice. Warm blur/focus resumption is covered by the automated suite; the Home device test establishes cold-relaunch recovery.

After the CI cleanup refactor to async/await, the clean packages were rebuilt and the tutorial opening sentences were replayed on both devices. Native EOF and cleanup completed without deinitialization timeouts. Two further regressions cover synchronous and asynchronous release failures.

## CodeRabbit follow-up

Ten further regressions reproduced the review findings before the fixes and passed afterwards. Eight cover decoder errors on either pass of a crossfade after Music off, a null theme, a result hold or catalog removal. Two cover appended ID3v2.4 tags, alone or before ID3v1, and malformed footer boundaries. README playback claims now link to their tests and device evidence.

The crossfade cases were repeated separately on VVD and the Stick with real native players. A temporary fixture invoked the captured error handler while both passes were active, then sampled the volume values sent to the native setters and awaited native release completion. All eight cases passed on each device: the surviving pass never faded back in during silence, both passes were released, and the requested theme returned after the result hold. Each run completed 18 native releases; the longest took 162 ms on hardware and 133 ms on VVD. There were no unexpected native errors or release timeouts. Recorded audio was available from VVD; the hardware result rests on its own playback events, requested volume ramps and release completions.

All 272 generated MP3 copies remained byte-identical to the previously validated copies after adding appended-tag support. The new tag cases are synthetic packaging regressions; no current vendor asset needed further stripping.

## Final package and saved data

The clean Release packages were installed on both devices after removing the temporary wrappers. Both deployed JavaScript and Hermes bundle SHA-256 digests matched their package archives. The JavaScript and Hermes bundles in all three Release archives contained no diagnostic wrapper markers. All four music catalog digests matched the packaged MP3s.

The original MMKV data and CRC files were restored on each device. After the clean package launched, both files matched their respective pre-test backups byte for byte. This preserves the saved game, ledger and settings.

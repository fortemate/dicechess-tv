# Audio lifecycle validation for PR #479

Checked on October 21, 2026. These are local Release-configuration builds of version 1.0.3, not published Appstore updates.

## What changed

`App.tsx` creates the real sound and music objects after the first React commit. `lateAudio.ts` keeps the screens' audio references stable and forwards settings, theme and suspension state when the players attach. It retains the current startup speech request once; stopping, disabling voices, suspension or disposal cancels that request. Consumed speech is not replayed on reattachment, and early effect cues are not queued for later playback.

The three effect channels release their players on loss of focus without pausing them first. A foreground return schedules their recreation; an effect cue can acquire them sooner. An initially background or inactive app starts suspended and opens no effect pipelines. Music's periodic ticker runs only during fades, ducking or playback startup; settled playback uses a timer for the next loop seam. Unmounting disposes the app's players.

## Physical Fire TV Stick

Both runs used the armv7 Release on a physical Fire TV Stick 4K Select under a separate QA package identity. The installed JavaScript, Hermes and engine hashes matched their archives. Application JavaScript matched the standard package after normalizing its registration ID; the engine matched without normalization. No runtime probes or delayed callbacks were injected. This establishes neither an Amazon-signed in-place upgrade nor execution of the other architectures.

| Build | Application commit                         | Physical checks                                                                                                                                                                                                                                                                |
| ----- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 53    | `667375e1be033e6ea5c32b55b1e600999fc759eb` | Three clean first launches, ten cold launches, ten game-menu Home returns including 180 seconds away, and three audio-settings Home returns. Five natural complete games: Rampage as White and Black, Grabby as White, Rolly as Black, and Hot Seat with both sides automated. |
| 54    | `fde68746f4255831a690b52480450d474523888f` | Follow-up after review: one clean first launch, three cold launches and three Home returns of 5, 30 and 5 seconds. No full games were repeated on this build.                                                                                                                  |

The runs used actual D-pad, OK, Back and Home events through the device input service. The Home returns kept the same process and exact saved game. Build 53 also preserved audio mute states and levels across its settings returns. Its 205-second menu playback window crossed a loop seam: native events showed a new player, opposing requested gain ramps and release of the previous player. These are playback requests and events, not a listening check.

No new crash-history entries were recorded. At the end of each run, the owner's current QA MMKV data and CRC were restored and verified byte-for-byte after relaunch. The protected Appstore build 30 package stayed unchanged; its data was not exported or written. The ordinary QA package was left closed, and the local build output was restored to the standard package identity.

## Automated regressions

At the build 54 application revision, the required local checks passed with 335 core, 698 native and 13 browser-bench tests: 1,046 total. Coverage, Metro, browser build and Release builds for armv7, aarch64 and x86_64 also passed. Only armv7 ran in this physical follow-up.

- `native/test/firstFrame.test.tsx` checks that no player is made during the first commit's layout phase.
- `native/test/tutorialOffer.test.tsx` checks the first greeting through the app's default audio path. Before the pending-line fix, its first sentence was lost.
- `native/test/soundApp.test.tsx` covers cached settings, pending-line replacement and cancellation, reattachment, channel cleanup and app lifecycle. Background and inactive startup cases each reproduced three pipeline initializations before the fix; after it, they require zero until focus returns, then delayed acquisition and a game cue.
- `native/test/sound.test.ts` covers channel release, delayed and early reacquisition, stale callbacks, one source per player and disposal. `native/test/music.test.ts` covers the idle seam timer, transitions and cleanup.

## Limits

Build 53's continuous system log ended during the game phase. It covers the lifecycle and loop checks; the later games have complete saved-state histories and result screenshots, but incomplete continuous native/JS traces. Build 54's first attempt was stopped when its SDK log follower exited; it was retained and excluded from the final run. The repeated smoke run kept a live collector through cleanup. Raw captures, packages, source maps and available logs are retained separately from this repository.

These are functional checks, not measurements of launch acceleration, key latency or CPU savings. Human listening through the TV speakers and a two-human Hot Seat session remain manual checks. Initial background/inactive construction was reproduced in Node integration tests, not forced on the physical Release. The clipped pronunciation in Thinkle's greeting remains a separate report, [#482](https://github.com/fortemate/dicechess-tv/issues/482); retaining a pending sentence does not establish a fix for that audible defect.

# Opponent runtime validation for PR #480

## Physical Fire TV Stick

On October 21, 2026, Release 1.0.3/build 51 from commit `53da44fd302b018bec152bd1433ce43a21535a87` ran on a physical Fire TV Stick 4K Select. The armv7 package used a separate QA identity to preserve the installed Appstore build 30. Its JavaScript was byte-identical to the ordinary Release after normalizing one app-registration literal; the engine asset was identical without normalization. This does not establish an in-place upgrade from the Amazon-signed app.

The run used automated D-pad, OK, Back and Home events through the device input service. Eight games reached a natural result from their initial positions: two per bot, with the player on each side, and two Hot Seat games with both sides automated. Hot Seat was not a two-human playtest. Menu/resume worked during the slow Rampage position reconstructed from the store failure. Cold restart during search, a 180-second Home interval, replacement of a pending game and settings persistence were also checked. No new crash-history entry was recorded. The run did not measure key latency or include human listening to the TV output.

The build's `native/build/lib/rn-bundles/Release/system-bundle-app-dependencies.json` lists `@amazon-devices/react-native-worklets` version `1.0.1+0.6.0`. Its JavaScript is excluded from the app bundle. Worklet searches in this physical run establish that the Stick supplied that system bundle. The older Virtual Device run in #338 predates this dependency and cannot establish that fact.

## Build 52 follow-up after review

The final PR revision, `1593258c363609c5d209c0a4c3e017ae61f6a1a1`, was checked again on October 21, 2026, with Release 1.0.3/build 52. The ordinary armv7 Release ran under the separate QA identity, with installed payload hashes and standard/QA equivalence verified as above. These were local test packages, not a published Appstore update.

Eight new games reached natural king-capture results from their initial positions: one game as each side against each bot, plus two Hot Seat games with both sides automated. Prepared positions and partial games are excluded from that count. The slow Rampage position, Menu/resume during search, cold restart during search, a real 180-second Home interval in the same process, pending-game replacement and queued new-bot play passed. Settings, volume boundaries, mute/toggle behavior and cold persistence, all six tutorial lessons, all nine Rules topics and About were also checked.

A separate diagnostic package delayed only the first native response callback, leaving the canonical engine and ordinary transport deadline unchanged. On the physical Stick, both Recovery choices, Back to the menu and Start fresh, passed the timeout, early overlap rejection, late-result discard and subsequent successful bot play in the same process. This modified diagnostic run is separate from the ordinary Release evidence. It does not prove recovery from a native job that never finishes. The diagnostic package was removed afterward.

No new crash-history entry was recorded. The ordinary QA package was left closed, the initial QA MMKV data and CRC were restored byte-for-byte after the first screen was ready, and the protected store build 30 package stayed unchanged. Store data was not exported or written. Human TV-output listening, a two-human game, input-latency measurement and an Amazon-signed in-place upgrade were not established.

The required local checks passed with 335 core, 672 native and 13 browser-bench tests, 1,020 total, plus coverage, Metro, notices, browser and site builds. Release packages built for armv7, aarch64 and x86_64; aarch64 and x86_64 were not run in this follow-up.

## Vega Virtual Device and other architectures

The worklet ran on the Vega Virtual Device with Release 1.0.3/build 48. This is separate from the physical build 51 evidence. The x86_64 package was built but not run.

## Automated regression checks

`native/test/botWorker.test.ts` checks request serialization, mailbox ownership, canonical legal replies, foreground-only transport deadlines, late settlement after timeout and disposal. A pending job must block another search; once it settles, a later request may proceed. Late replies cannot replace a newer game's state.

`native/test/recovery.test.tsx` checks that a timed-out request reaches Recovery with the save intact, that an early retry cannot overlap it, and that resuming after its late completion uses the same client successfully. The tests use fake clocks and platform stubs; they do not establish native threading or responsiveness.

`web/test/botTask.test.ts` checks that the browser transport remains pending until its Web Worker terminates, including failure paths. Posting the request alone must not release the client's overlap guard. This is browser-transport contract evidence, not Fire TV evidence.

A genuinely hanging native job remains blocked until the app restarts. The transport timeout neither cancels the canonical search nor changes its algorithm or work budget. Forced response-delay diagnostics must be reported separately from ordinary Release runs.

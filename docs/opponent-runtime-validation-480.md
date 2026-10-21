# Opponent runtime validation for PR #480

## Physical Fire TV Stick

On October 21, 2026, Release 1.0.3/build 51 from commit `53da44fd302b018bec152bd1433ce43a21535a87` ran on a physical Fire TV Stick 4K Select. The armv7 package used a separate QA identity to preserve the installed Appstore build 30. Its JavaScript was byte-identical to the ordinary Release after normalizing one app-registration literal; the engine asset was identical without normalization. This does not establish an in-place upgrade from the Amazon-signed app.

The run used automated D-pad, OK, Back and Home events through the device input service. Eight games reached a natural result from their initial positions: two per bot, with the player on each side, and two Hot Seat games with both sides automated. Hot Seat was not a two-human playtest. Menu/resume worked during the slow Rampage position reconstructed from the store failure. Cold restart during search, a 180-second Home interval, replacement of a pending game and settings persistence were also checked. No new crash-history entry was recorded. The run did not measure key latency or include human listening to the TV output.

The build's `native/build/lib/rn-bundles/Release/system-bundle-app-dependencies.json` lists `@amazon-devices/react-native-worklets` version `1.0.1+0.6.0`. Its JavaScript is excluded from the app bundle. Worklet searches in this physical run establish that the Stick supplied that system bundle. The older Virtual Device run in #338 predates this dependency and cannot establish that fact.

## Vega Virtual Device and other architectures

The worklet ran on the Vega Virtual Device with Release 1.0.3/build 48. This is separate from the physical build 51 evidence. The x86_64 package was built but not run.

## Automated regression checks

`native/test/botWorker.test.ts` checks request serialization, mailbox ownership, canonical legal replies, foreground-only transport deadlines, late settlement after timeout and disposal. A pending job must block another search; once it settles, a later request may proceed. Late replies cannot replace a newer game's state.

`native/test/recovery.test.tsx` checks that a timed-out request reaches Recovery with the save intact, that an early retry cannot overlap it, and that resuming after its late completion uses the same client successfully. The tests use fake clocks and platform stubs; they do not establish native threading or responsiveness.

`web/test/botTask.test.ts` checks that the browser transport remains pending until its Web Worker terminates, including failure paths. Posting the request alone must not release the client's overlap guard. This is browser-transport contract evidence, not Fire TV evidence.

A genuinely hanging native job remains blocked until the app restarts. The transport timeout neither cancels the canonical search nor changes its algorithm or work budget. Forced response-delay diagnostics must be reported separately from ordinary Release runs.

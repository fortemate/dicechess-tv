# Dice Chess 1.0.5, build 59: release preparation

Prepared on October 22, 2026, following `v1.0.4+58`. The proposed tag is `v1.0.5+59`. The manifest version rises from 1.0.4 to 1.0.5 because the release procedure requires both the version and build number to increase for an Appstore submission. The build number is supplied to the build command, without overriding the manifest version.

The [release notes](release-notes-1.0.5-build59.md) describe the changes since build 58. This PR changes version metadata and release documentation only. It does not create a tag, publish packages or submit an Appstore update.

## Physical validation before the version change

Merged main `3d2e1d8c88d595e4fc3e7c2bbca2ab9217bf72ef`, including [#490](https://github.com/fortemate/dicechess-tv/pull/490), was built as 1.0.4/build 59 and tested on a physical armv7 Fire TV Stick. This is evidence for the integrated application before the manifest version change, not for final 1.0.5 archives.

- Settings covered all three volume controls, off and levels 1–10, bounds, mute/unmute, other setting cycles and cold persistence. All nine Rules topics, About and all six tutorial lessons were exercised through D-pad, OK and Back events.
- Rolly, Grabby and Rampage each had partial games, a resignation result and a rematch. All three hosts had partial friend games, results and new games. White and Black player orientations were covered.
- Five short Home returns retained the same process and exact game, dice and settings. Cold launch persistence was checked separately.
- A continuous Rampage session exceeded ten minutes without a process restart. One game ended naturally by king capture, and play continued into the rematch. The other short sessions are not counted as completed full games.
- A separate temporary diagnostic package played all 179 expansion recordings through the production voice/music implementations and native AudioPlayer. Every recording reached native completion without player errors or timeouts; music gain and playback progress recovered after every line. This direct audio API sweep does not establish all 179 game-event triggers or human listening approval.
- The ordinary package was restored after diagnostics. All 446 installed voice files, JavaScript, Hermes and opponent engine matched the ordinary package by SHA-256. All 475 non-metadata application files matched the earlier tested ordinary archive. Saved data and CRC were restored byte-for-byte, and the app was closed. No new crash-history entry was found.

The owner separately confirmed complete speech and returning music for the earlier six start/result/rematch listening sequences. There was no human listening or television-output recording during the unattended 179-line sweep. Physical remote hold behavior, VoiceView, long background eviction and an Amazon-signed store upgrade are outside this validation.

## Final packaging after owner merge

The owner reviews and merges this version PR. Rebuild all three architectures from the exact merged main commit with build number 59, after removing generated `native/build/`, as described in [CONTRIBUTING.md](../CONTRIBUTING.md#releases). If another release or submitted build has used 59, choose a higher number and update the release identity before building.

Verify manifest/build-info agreement, ABI, ten runtime portraits, 446 voice files, notices and cross-architecture bundle identity. Compare the final application payload with the tested candidate, and validate the exact final armv7 archive on the physical Stick, including an upgrade without uninstalling and saved-data preservation. Developer-package preservation does not establish an Amazon-signed store upgrade.

Collect three final `.vpkg` packages and `SHA256SUMS.txt` for GitHub; keep the armv7 package separately for a later authorized Appstore upload. Retain candidate/final provenance and device evidence outside the release assets. Only the owner creates the signed version tag, publishes the release and uploads to Amazon. Read back the published tag, metadata and downloads, and verify downloaded checksums. GitHub publication does not establish Appstore approval.

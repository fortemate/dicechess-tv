# Dice Chess 1.0.4, build 55: GitHub release preparation

Prepared on October 21, 2026, from main `a6f86b44989c9e1b84a3ab3bd6481adfe12e4851`, following `v1.0.3+34`. The only application change in the release preparation is the manifest version bump from 1.0.3 to 1.0.4. The proposed tag is `v1.0.4+55`; build 55 also exceeds the local QA builds through 54. No tag or release has been created and no package has been uploaded to Amazon Appstore.

The [release notes](release-notes-1.0.4-build55.md) describe the changes since build 34 and the remaining Thinkle greeting issue, #482. Earlier physical results for #479 and #480 are documented separately and are not counted as a hardware run of this candidate.

## Local validation

- Fresh root, native and web dependencies were installed with `npm ci` using Node 26.8.2.
- `mise run check` passed: 335 core, 698 native and 13 browser-bench tests, 1,046 total, with no failures or skips. Type checks, lint, formatting, Metro, the browser build and whitespace checks passed.
- A clean Vega SDK 0.24.12044 Release build produced armv7, aarch64 and x86_64 packages. No runtime probes, injected delays or package identity changes were used.
- The package manifests, build metadata and `vpt info` agree on version 1.0.4, build 55 and the original `com.fortemate.dicechesstv` package identity.
- ELF headers identify ARM, AArch64 and x86-64 libraries in the respective archives. Every package contains exactly ten runtime portrait PNGs and the license notices; the unused source SVG is excluded.
- `vpt validate` passed manifest and ABI validation for all three packages, with zero manifest errors.
- JavaScript, Hermes, the opponent engine bundle and generated third-party notices have identical hashes across architectures. The bundled-notice source-map check passed.

| Candidate                          | SHA-256                                                            |
| ---------------------------------- | ------------------------------------------------------------------ |
| `dicechess-tv-native_armv7.vpkg`   | `5a4825243d627499d9ac8d828ff4441445139a63d5307deed1786313fceadd6c` |
| `dicechess-tv-native_aarch64.vpkg` | `6e809ef91f04f1d1717387189692bc1c2ed23add813c486a590c5e65c4181e05` |
| `dicechess-tv-native_x86_64.vpkg`  | `99ce2629093e2b20b21233265d880ab678f092f9bda0bce74ebd6a48e02653cc` |

These hashes identify the preparation candidates. Rebuild from final merged main before publication and record the final package hashes separately.

## Physical Fire TV Stick

**Pending.** The previously used physical device was unreachable during preparation. No candidate was installed and no device input was sent. The owner's installed store package, saved data and settings have not been changed by this preparation.

Before declaring the release ready:

- Preserve the currently installed package metadata, MMKV data and CRC, settings, crash history and device state before installation. If the store's signing or data restrictions prevent a safe upgrade, record that limit before choosing a separate QA package; a changed package identity is not an exact release-package installation.
- Install the ordinary armv7 candidate without uninstalling. Confirm actual version/build metadata and compare the installed JavaScript, Hermes and opponent engine hashes with the candidate archive.
- Check cold launches, D-pad/OK/Back, the tutorial, Rules/About, settings and sound controls, saved-game recovery, Menu/resume and Home returns. Complete games against each opponent, including Rampage as both colors, and exercise Hot Seat with automated sides recorded explicitly.
- Retain system logs and crash/ANR evidence. Restore test data byte-for-byte and verify it again after relaunch. Human TV listening and a two-human session remain separate checks.

## Owner publication handoff

Keep the preparation PR in draft until physical verification is complete and review checks pass. The owner merges the version PR, then the packages must be rebuilt from that exact main commit and compared with the tested application payload. Check that the proposed version/build is still unused before the owner creates the signed tag and publishes the three packages plus `SHA256SUMS.txt` to GitHub.

Do not publish or submit to Amazon Appstore in this task. Recheck the latest submitted build number and validate the Amazon-signed upgrade separately before a later Appstore submission.

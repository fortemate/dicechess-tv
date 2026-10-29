# Android TV About validation

This records the build before Settings was enabled. See
[settings-validation.md](settings-validation.md) for the subsequent menu and
audio integration; current smoke scripts follow the current menu.

On October 29, 2026, About was added after Rules reference in the Android home
menu, retaining Vega's menu definition and order. It renders the shared
`AboutScreen` through the existing Android `RemoteSurface`.

## Content and behavior

`AboutScreen` now accepts optional build content. Android supplies three cards
using the canonical authors' wording: RhosGFX pieces and fallback faces,
JDSherbert piece sounds, and Kenney dice/result sounds. This build has no music
or portraits, so it omits the music card and does not probe Vega's portrait path.
Its source row points to the repository and asset notices. It makes no claim
that a complete Android dependency-notice bundle ships in this prototype APK.

Without explicit build content, Vega retains its four credit cards, runtime
portrait detection and original open-source notice text. The shared layout and
remote reducer are unchanged. No assets, dependencies or game rules changed.

About has one page. Directions leave it open; OK or Back returns to the focused
About home row. It receives no game store or worker. System Home/return retains
the mounted screen; a cold launch returns home, where the real game is resumable.

## Local checks

- `mise run check` passed: 337 core, 735 native and 13 browser tests, types, lint,
  formatting, Vega Metro bundle and browser build.
- Android types, lint and all 46 tests passed. Total: 1131 tests.
- Existing native tests retain default Vega credit and portrait-fallback
  expectations. A new render test checks explicit content, custom notices and
  the absence of a hidden Vega image probe or unintended default cards.
- The menu test includes About's shared label/order and separate screen route.
- Android APK and Vega release-package builds passed. Python smoke scripts
  parsed successfully.

## Android TV emulator

Standalone ARM64 APK, Android TV Android 12/API 31, 1920 × 1080 at 320 dpi. The
release variant uses the generated debug signing key and includes JS/assets,
without a Metro server. APK SHA-256:

```text
fed9fea8d30672807d867892aed8053086b852c84b18017073a6d1c489040c4b
```

Five About-specific groups passed:

1. Home opens three Android credit cards without a game, worker or Vega portrait
   probe. The shared screen's report confirms the explicit build content.
2. All four directions keep About open. OK returns to the focused About home row.
3. System Home/return retains the screen. Back restores home focus without
   mounting a game.
4. Reading, exiting and process death in About preserve every field of a real
   friend partial-turn save.
5. The same checks preserve every field of a real bot partial-turn save.

The Android About screenshot was visually inspected: all three credit cards,
author links, source row and return hint fit the tested viewport. This visual
claim is specific to the Android TV emulator.

All nine existing home/menu regression groups also passed on this APK, for
14 Android device groups in total: menu order and directional wrap, canceled
selection without a save, exact partial-turn recovery, canceled and confirmed
opponent changes, rematch, result-to-home behavior, diagnostic exit and cold
launch. Fresh and resumable-game menu screenshots were visually inspected;
all five or six rows, descriptions and the remote hint fit the viewport.

The disposable probe data was cleared for the home suite after the About
preservation checks finished. About itself was tested without clearing data.
Evidence is retained under `android-probe/build/about/` and
`android-probe/build/about-home/`. Rules, tutorial and migration scripts were
updated for the new menu and parsed; their full device suites were not rerun
for this change.

The strengthened About suite was rerun on the same APK after review; all five
groups passed. Each direction and system Home/return now reads a fresh Android
UI hierarchy and requires this app's `About Dice Chess` surface. The previous
dump is removed first so a failed capture cannot reuse old evidence. Mount
reports are used only when entering About. Per-direction XML and screenshots
are retained under `android-probe/build/about-review/`.

A separate negative control invoked the same assertion on the main menu while
old About reports remained in logcat; it correctly rejected that screen.
`mise run check` passed again (337 core, 735 native and 13 browser tests, types,
lint, formatting and bundles/builds). This follow-up changes only the Python
smoke test and this record; the installed APK hash was verified unchanged.
The earlier home/menu and Vega runs above were not repeated for this test fix.

## Vega regression

The same source was built with the Vega SDK as local build 59. ARM64 package
SHA-256:

```text
8818d65283d793bd70173cc2c9aa9b1043309ceb84f59418f09fd16c69d4eb46
```

The package was installed and launched on the ARM64 Vega Virtual Device. The
About screenshot was visually inspected: four default cards, including Music,
the Pieces-only card with portrait detection, and the original shipped-license
text were present. This is separate from the Android screenshot inspection.

All four directions left the exact About screenshot unchanged. OK, Back and
Menu each returned to matching home screenshots. Existing game pieces remained
in their prior positions; no new game or move was started during this check.
Screenshots and the three regression checks are retained under
`android-probe/build/about-vega/`. No physical Fire TV Stick check was performed.

## Reproduce and limits

Build and install the standalone Android APK as described in [README.md](README.md).
With Node from mise on PATH, run from the repository root:

```sh
mise exec -- python3 android-probe/scripts/about-smoke.py --serial <serial> \
  --output android-probe/build/about
```

Supply `--adb <path>` if needed. The suite preserves app data but replaces the
current probe game through normal confirmation. It uses real D-pad/OK/Back/Home
events and normal game randomness; no game state or moves are injected.
Screenshots, event reports and logcat are saved in the ignored output directory.

This record distinguishes Android TV emulator and Vega Virtual Device evidence
from physical Android TV/Fire OS and Fire TV Stick testing. Held keys, Android
accessibility, other viewports/ABIs and physical remotes remain separate work.
Host audio was disabled on the Android emulator with the existing CoreAudio
workaround; this work does not qualify human listening.

The on-screen credits do not replace full Android dependency notices, which
remain a distribution gate. Settings is the remaining hidden ordinary-menu
entry. No release, deployment or Appstore action was performed.

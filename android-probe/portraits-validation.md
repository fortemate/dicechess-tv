# Android character portrait validation

Android renders Vega's `OpponentScreen` and `Portrait` components. The shared
`Teacher` inside `TutorialScreen` receives the same Android image sources, so
Thinkle now has his portrait in lessons. Gameplay shows the selected opponent's
badge. Remote events continue through the existing Android channel and shared
reducer.

`PortraitSources` supplies platform image sources with a context provider. Its
default retains Vega's existing package URLs. Android resolves static Metro
asset references for the canonical five characters at card and badge sizes.
The existing missing-image fallback remains in the shared renderer.

Asset generation checks the pinned original PNGs and notice against the
canonical portrait lock. The notice permits these images in Fortemate Dice
Chess applications on any platform; it grants no general reuse license.
Generated Android assets remain ignored. Metro bundles the images and original
notice for offline use. Android optimizes PNG encoding in the release APK;
all ten images were checked against their source RGBA pixels, and the notice
matched its original bytes.

## Reproduce

Build/install the standalone ARM64 APK as described in README, then run from
the repository root:

```sh
mise exec -- python3 android-probe/scripts/portraits-smoke.py \
  --serial <serial> --output android-probe/build/portraits
mise exec -- python3 android-probe/scripts/tutorial-smoke.py \
  --serial <serial> --output android-probe/build/portraits-tutorial
```

Add `--adb <path>` when needed. These suites replace the disposable probe's
current game through normal UI and use real remote events. They do not inject
game snapshots or random rolls. Screenshots require visual inspection in
addition to the event assertions.

## Observations: October 30, 2026

- Android typecheck/lint and all 60 tests passed. `mise run check` passed:
  337 core, 738 native and 13 browser tests, types, lint, formatting, Metro and
  browser builds. The new native regression checks custom platform sources on
  shared cards and the existing missing-image fallback.
- ARM64 release APK and all configured Vega architectures built successfully.
  APK SHA-256:
  `1137ac3fbec3ac4914e489f7c291ec46d13e6f63ee227750252373ede19873ba`.
- On DiceChessTVProbe (Android TV API 31, ARM64), the portrait smoke passed both
  groups: all three cards, all four directions, OK/Back, exact rolled friend-game
  preservation after cancel and force-stop, and a Rolly game restored with its
  exact roll and side. Card and gameplay badge screenshots were inspected.

- `tutorial-smoke.py` passed all ten groups: six lessons, all four directions,
  OK/Back/Home, closing choices and confirmations, exact friend/bot save
  preservation, and force-stop recovery. Thinkle's lesson portrait was visually
  inspected.

Evidence is local and ignored under `android-probe/build/portraits-retry/` and
`android-probe/build/portraits-tutorial/`.
This does not qualify physical TV devices, held keys, accessibility, voice
sequencing or a production release. Vega runtime was not exercised in this
slice; its default sources are covered by tests and its packages were built.

# Launch splash inputs

The owner selected **Soft bounce** for issue #289: the title above three dice,
with a single fall and a small rebound into a stable final composition. The
title and the Fortemate developer credit are visible from the first frame.
The dice enter below the title so they cannot obscure it.

`scripts/splash-frames.mjs` renders 18 opaque 1920 × 1080 frames at build time
with `@resvg/resvg-js` 2.6.2 (MPL-2.0). The renderer is a development dependency;
it is not imported by the application. The font files and renderer are excluded
from the device bundle; the new splash artwork ships as the generated PNG archive.

The typeface is **Arimo**, Regular and Bold, copied unchanged from
[googlefonts/Arimo](https://github.com/googlefonts/Arimo/tree/4a6255f269916ae7ad3fc2706b0935e7621396b8/fonts/ttf)
at commit `4a6255f269916ae7ad3fc2706b0935e7621396b8`. Its SIL Open Font License 1.1
is retained verbatim in `fonts/OFL.txt`.

| Input             | SHA-256                                                            |
| ----------------- | ------------------------------------------------------------------ |
| Arimo-Regular.ttf | `41b22bc8f0b51f932825d37bc55b5eb6ba67dfe599a626e4aff2b43b624f9f8c` |
| Arimo-Bold.ttf    | `d7a8b187cf8444d4cfee102e8eae9e3043682fd5106d5d33ed677fe268a0e2ba` |

The knight, rook and king are the existing RhosGFX CC0 SVGs in
`src/assets/pieces/rhosgfx/`, embedded unchanged. The Fortemate mark remains
the unmodified export in `native/brand/`. The text "by Fortemate" is a
developer credit in the splash, not an approved organization wordmark.

## Hardware trial limitation

On physical Vega OS 1.2 (TV Ship/48), the service repeated all PNG entries
even with `c 1 0 _loop` or a separate infinite hold part. This prototype uses
the documented `c 0 0 _loop` with 18 moving frames followed by 30 identical
final frames, a nominal one-second still tail. The PNGs are stored in explicit
playback order; recursive ZIP traversal scrambled them on APFS.

A longer 600-frame tail caused the service to prepare the splash only after
the application was already visible. It was discarded; the shorter archive
is a trial compromise, not a reliable one-shot animation.

The tail is not an application loading timer: ready content can replace the
native splash at any point. A stalled start longer than the complete archive
can repeat the reveal. This trial does not close issue #289's requirement for
an indefinitely quiescent final state. An actual one-shot service contract or
a different platform mechanism is still needed for that.

The application keeps the default automatic splash dismissal. There is no
minimum display timer, loading component or input interception.

## Trial validation (2026-10-07)

- Root checks and tests passed. Native checks and tests passed (392 passed,
  one intentionally skipped); release packages built for all three architectures.
- On the physical stick, the service displayed the new artwork, then the
  application's saved-game home screen. Injected D-pad, OK and Back opened
  and cancelled the replacement prompt without replacing the saved game.
- Playback on the stick was slower than the nominal 30 fps / 600 ms reveal.
  Screenshot sampling does not establish a dropped-frame count or smoothness.
  The same-device before/after launch comparison remains unvalidated: the
  controlled baseline run did not yield a complete KPI set.
- The Virtual Device showed a black native splash in these runs, so it supplies
  UI handover evidence only. An isolated package identity with the same app
  code and a plain JS bundle exercised first tutorial offer, Skip, no-save
  home, Rules reference, new Hot Seat, pause and saved-game relaunch through
  D-pad, OK and Back. The production package's existing data was retained.

The asset tests read back the generated PNGs and ZIP: opaque RGB, safe margins,
unchanged title and credit, distinct dice faces, unchanged launcher icon,
identical final frames, chronological archive entries, and a byte-identical
rebuild under a different timezone. Raw device logs remain local because they
contain operator-specific identifiers. This is concept validation, not complete
acceptance of issue #289.

# Launch splash

The native splash (#289) is "Thinkle conjures", which the owner chose on
2026-10-08 as a still. Thinkle sits in an ivory-rimmed medallion, as on the
opponent cards; three chess dice, queen, knight and rook, float on a dotted
orbit beside him; "Dice Chess" leads on the left in Titan One; the Fortemate
mark sits beside its name as the developer credit.

`scripts/splash.mjs` draws it at build time with `@resvg/resvg-js` 2.6.2
(MPL-2.0, a development dependency), and `scripts/generate-assets.mjs` packs the
single PNG into `assets/raw/SplashScreenImages.zip`. Nothing here, the fonts and
Thinkle's vector included, goes into the package: the device gets pixels.

## Why one frame

Vega's animation service plays the archive in a loop, whatever `desc.txt` asks.
On our Fire TV Stick (Vega OS 1.2) a count of 1 and a separate hold part both
repeated the whole archive (#290), as a
[public bug report](https://community.amazondeveloper.com/t/28867) describes.
The splash is on screen for about 2.2 s of a cool start there: its first frame
at 0.41 s, the game fully drawn at 2.65 s (see the performance page). So a
reveal either repeats or is cut halfway, and a slower start repeats it more. A
still does neither. Animated concepts were tried in #290 and in a design review;
the owner chose a still for now.

## Inputs

| Input                                    | Source                                                                                          | Licence                                                       | SHA-256                                                            |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------ |
| `fonts/titan-one/TitanOne-Regular.ttf`   | `google/fonts` at `931162c4c695f5b29a1b26f007b656e2baca0884`, `ofl/titanone`                    | OFL-1.1, `fonts/titan-one/OFL.txt` (Reserved Font Name Titan) | `563ff6de179bbd44bcd7d2a6c448d6dc3bf935834237cf1250e506e65cd86ff1` |
| `fonts/arimo/Arimo-Regular.ttf`          | `googlefonts/Arimo` at `4a6255f269916ae7ad3fc2706b0935e7621396b8`, `fonts/ttf`                  | OFL-1.1, `fonts/arimo/OFL.txt`                                | `41b22bc8f0b51f932825d37bc55b5eb6ba67dfe599a626e4aff2b43b624f9f8c` |
| `../brand/fortemate-mark-white.svg`      | `fortemate/brand`, see `../brand/README.md`                                                     | Fortemate                                                     |                                                                    |
| `src/assets/pieces/rhosgfx/b{Q,N,R}.svg` | RhosGFX Vector Chess Pieces Pack                                                                | CC0-1.0                                                       |                                                                    |
| `portraits/thinkle.svg`                  | portrait pack 1.4.0 in `fortemate/dicechess-assets`, vendored by `scripts/vendor-portraits.mjs` | Fortemate's Dice Chess apps only                              | pinned in `portraits/portraits.lock.json`                          |

The fonts are copied unchanged, with their licences beside them. Titan One sets
the title; Arimo sets the name next to the mark, in plain type.

## Without the portraits

The portraits are private, and git ignores `portraits/` while this repository is
public. A checkout without them, CI's for one, draws Thinkle's starry hat in the
medallion instead; everything else is the same. `test/splash.test.ts` draws
both: a stand-in portrait and the hat.

## Size

The frame is about 124 KB as a PNG and the archive about 117 KB. Keep it small:
in #290 an archive of 17 MB made the service prepare the splash only after the
game was already on screen.

## Changing it

Edit `scripts/splash.mjs`, run `npm run assets`, and look at
`build/splash/_loop/loop00000.png`. Then look at it on a Fire TV Stick: in
#290's runs the Virtual Device showed the splash black.

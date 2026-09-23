# Third-party notices

The application imports the following dependencies. These notices do not select a license for Fortemate-authored TV application code or resolve the terms of a future combined distribution.

| Component                                                | Pinned version           | License               | Source                                             |
| -------------------------------------------------------- | ------------------------ | --------------------- | -------------------------------------------------- |
| Dice Chess engine                                        | 0.12.2                   | AGPL-3.0-only         | https://github.com/fortemate/dicechess-engine      |
| Vector Chess Pieces Pack, RhosGFX                        | 1.0.0                    | CC0-1.0               | https://rhosgfx.itch.io/vector-chess-pieces        |
| Tabletop Games SFX Pack, JDSherbert                      | 1.1.0                    | Free with attribution | https://jdsherbert.itch.io/tabletop-games-sfx-pack |
| Casino Audio, Interface Sounds and Music Jingles, Kenney | 1.1, 1.0 and unversioned | CC0-1.0               | https://kenney.nl                                  |

The engine and RhosGFX license texts are in [AGPL-3.0](licenses/AGPL-3.0.txt) and [CC0-1.0](licenses/RhosGFX-CC0.txt). Full installed-package notices are retained in node_modules, and build-generated license comments must not be removed. The package locks record the exact dependency graph. Before any external binary distribution, resolve the combined license, required notices and complete corresponding-source delivery, including applicable transitive dependencies.

Chess pieces use 12 vector SVG pieces (White and Black Outline variants) from the RhosGFX Vector Chess Pieces Pack, dedicated to the public domain under Creative Commons CC0 1.0 Universal and bundled locally. No cburnett artwork, opening book, private model or server implementation is bundled.

## Sounds

The game's sounds are vendored under `native/sounds/` from the private asset repository `fortemate/dicechess-assets`, at the commit recorded in `native/sounds/sounds.lock.json`, each pack beside its own manifest and licence file.

JDSherbert's licence requires visible credit, given on the About screen as `Sounds by JDSherbert – https://jdsherbert.itch.io`, and it forbids sharing the raw files. They may ship inside the application, but they may not be published on their own: **if this repository is ever made public, remove `native/sounds/jdsherbert-tabletop/` from it first.** Kenney's packs are CC0 and carry no such limit; the About screen credits them as a courtesy.

## Amazon platform packages

`native/` depends on `@amazon-devices/react-native-kepler`, `@amazon-devices/react-native-mmkv` and `@amazon-devices/react-native-svg` at runtime, and on `@amazon-devices/kepler-cli-platform` to build. They install from the public npm registry and are not redistributed by this repository.

The Vega SDK itself is licensed to each developer under Amazon's [Program Materials License Agreement](https://developer.amazon.com/support/legal/pml) and is deliberately not in this repository; what is committed is our own configuration. No Vega SDK material or Amazon sample code has been copied here.

## Removed

Chessground (GPL-3.0-or-later) and Svelte (MIT) were dependencies of the WebView probe, which was removed once the native board replaced it. Nothing in the application reaches them, and the GPL obligation Chessground carried no longer applies to anything that ships. `docs/` keeps the record of what the probe established.

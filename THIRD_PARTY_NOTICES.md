# Third-party notices

Fortemate's code in this repository is licensed under AGPL-3.0-only (see [LICENSE](LICENSE)). The third-party material below keeps its own licence and is not covered by the AGPL.

| Component                                                | Pinned version           | License               | Source                                             |
| -------------------------------------------------------- | ------------------------ | --------------------- | -------------------------------------------------- |
| Dice Chess engine                                        | 0.12.2                   | AGPL-3.0-only         | https://github.com/fortemate/dicechess-engine      |
| Vector Chess Pieces Pack, RhosGFX                        | 1.0.0                    | CC0-1.0               | https://rhosgfx.itch.io/vector-chess-pieces        |
| Tabletop Games SFX Pack, JDSherbert                      | 1.1.0                    | Free with attribution | https://jdsherbert.itch.io/tabletop-games-sfx-pack |
| Casino Audio, Interface Sounds and Music Jingles, Kenney | 1.1, 1.0 and unversioned | CC0-1.0               | https://kenney.nl                                  |

The engine and RhosGFX license texts are in [AGPL-3.0](licenses/AGPL-3.0.txt) and [CC0-1.0](licenses/RhosGFX-CC0.txt). Full installed-package notices are retained in node_modules, and build-generated license comments must not be removed. The package locks record the exact dependency graph.

Chess pieces use 12 vector SVG pieces (White and Black Outline variants) from the RhosGFX Vector Chess Pieces Pack, dedicated to the public domain under Creative Commons CC0 1.0 Universal and bundled locally. No cburnett artwork, opening book, private model or server implementation is bundled.

## Sounds

The game's sounds are vendored under `native/sounds/` from the private asset repository `fortemate/dicechess-assets`, at the commit recorded in `native/sounds/sounds.lock.json`, each pack beside its own manifest and licence file.

JDSherbert's licence requires visible credit, given on the About screen as "Sounds by JDSherbert" with the link jdsherbert.itch.io/tabletop-games-sfx-pack beneath it (the licence offers "Sounds by JDSherbert – https://jdsherbert.itch.io" as an example and calls a link optional), and it forbids sharing the raw files. The author, Josh Herbert, gave written permission on 24 September 2026 to include these four MP3 files in this public repository, with credit and a link to his page. That permission covers this project only: the files are not licensed under the AGPL, and using them anywhere else needs the author's permission or a copy of the pack from https://jdsherbert.itch.io/tabletop-games-sfx-pack. Kenney's packs are CC0 and carry no such limit; the About screen credits them as a courtesy.

## Amazon platform packages

`native/` depends on `@amazon-devices/react-native-kepler`, `@amazon-devices/react-native-mmkv`, `@amazon-devices/react-native-svg` and `@amazon-devices/react-native-w3cmedia` at runtime, and on `@amazon-devices/kepler-cli-platform` and `@amazon-devices/eslint-plugin-kepler` to build and lint. They install from the public npm registry under Amazon's Program Materials License Agreement and are not redistributed by this repository. A built package contains Amazon's MMKV native library, as every Vega app that uses it does; the other runtime libraries are provided by the device. No additional permission under section 7 of the AGPL has been granted for these libraries.

The Vega SDK itself is licensed to each developer under Amazon's [Program Materials License Agreement](https://developer.amazon.com/support/legal/pml) and is deliberately not in this repository; what is committed is our own configuration. No Vega SDK material or Amazon sample code has been copied here.

## Removed

Chessground (GPL-3.0-or-later) and Svelte (MIT) were dependencies of the WebView probe, which was removed once the native board replaced it. Nothing in the application reaches them, and the GPL obligation Chessground carried no longer applies to anything that ships. `docs/` keeps the record of what the probe established.

## Brand

`native/brand/` holds Fortemate brand images, copied verbatim from the brand repository for the splash screen. The Fortemate name and logo are not licensed under the AGPL.

`native/icon/` holds the game icon, copied verbatim from Fortemate's asset repository with its `NOTICE.txt`. The icon is Fortemate's artwork and is not licensed under the AGPL. It contains two pieces from the RhosGFX Vector Chess Pieces Pack (Outline set), which are CC0 and credited above.

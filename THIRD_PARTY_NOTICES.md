# Third-party notices

Fortemate's code in this repository is licensed under AGPL-3.0-only (see [LICENSE](LICENSE)). The third-party material below keeps its own licence and is not covered by the AGPL.

| Component                                                                  | Pinned version                | License                  | Source                                                 |
| -------------------------------------------------------------------------- | ----------------------------- | ------------------------ | ------------------------------------------------------ |
| Dice Chess engine                                                          | 0.14.0                        | AGPL-3.0-only            | https://github.com/fortemate/dicechess-engine          |
| Vector Chess Pieces Pack, RhosGFX                                          | 1.0.0                         | CC0-1.0                  | https://rhosgfx.itch.io/vector-chess-pieces            |
| Vector Emojis, RhosGFX                                                     | downloaded 2026-09-26         | CC0-1.0                  | https://rhosgfx.itch.io/vector-emojis                  |
| Tabletop Games SFX Pack, JDSherbert                                        | 1.1.0                         | Free with attribution    | https://jdsherbert.itch.io/tabletop-games-sfx-pack     |
| Casino Audio, Interface Sounds and Music Jingles, Kenney                   | 1.1, 1.0 and unversioned      | CC0-1.0                  | https://kenney.nl                                      |
| Dice Chess themes, pepka-prygni                                            | 0.2.0 (four tracks)           | Permission for this game | https://www.youtube.com/@genreexplorer-h5o             |
| Dice Chess bot voices, Fortemate, made with ElevenLabs                     | 63 lines                      | Fortemate apps only      | https://elevenlabs.io                                  |
| Dice Chess Hot Seat host Rolly, Fortemate, made with ElevenLabs            | 48 lines                      | Fortemate apps only      | https://elevenlabs.io                                  |
| Dice Chess Hot Seat host Prowla, Fortemate, made with ElevenLabs           | 54 lines                      | Fortemate apps only      | https://elevenlabs.io                                  |
| Dice Chess Hot Seat host Thinkle, Fortemate, made with ElevenLabs          | 54 lines                      | Fortemate apps only      | https://elevenlabs.io                                  |
| Dice Chess TV tutorial, taught by Thinkle, Fortemate, made with ElevenLabs | 48 lines                      | Fortemate apps only      | https://elevenlabs.io                                  |
| Dice Chess TV demo narration, Thinkle, Fortemate, made with ElevenLabs     | 15 lines                      | Fortemate apps, videos   | https://elevenlabs.io                                  |
| Dice Chess character portraits, Fortemate, made with Recraft               | 1.4.0 (five characters shown) | Fortemate apps only      | https://recraft.ai                                     |
| Titan One font, Rodrigo Fuenzalida (splash title, build time only)         | google/fonts 931162c          | OFL-1.1                  | https://github.com/google/fonts/tree/main/ofl/titanone |
| Arimo font, The Arimo Project Authors (splash credit, build time only)     | googlefonts/Arimo 4a6255f     | OFL-1.1                  | https://github.com/googlefonts/Arimo                   |
| resvg-js, rasterizes the splash (development dependency)                   | 2.6.2                         | MPL-2.0                  | https://github.com/thx/resvg-js                        |

The engine and RhosGFX license texts are in [AGPL-3.0](licenses/AGPL-3.0.txt), [CC0-1.0](licenses/RhosGFX-CC0.txt) and, for the emojis, [CC0-1.0](licenses/RhosGFX-Emojis-CC0.txt). Full installed-package notices are retained in node_modules, and build-generated license comments must not be removed. The package locks record the exact dependency graph.

Chess pieces use 12 vector SVG pieces (White and Black Outline variants) from the RhosGFX Vector Chess Pieces Pack, dedicated to the public domain under Creative Commons CC0 1.0 Universal and bundled locally. No cburnett artwork, opening book, private model or server implementation is bundled.

The faces of the three local opponents are three SVGs from the RhosGFX Vector Emojis pack, Outline set: `Zany face.svg`, `Money mouth face.svg` and `Smiling face with horns.svg`. They are bundled unchanged, under shorter names, in `src/assets/faces/rhosgfx/`, and drawn by the components `native/scripts/generate-faces.mjs` writes to `native/src/faces/`. The pack is dedicated to the public domain under CC0 1.0. Its notice, in `licenses/RhosGFX-Emojis-CC0.txt` with LF line endings, is the one RhosGFX ships with the pack: it names the Vector Ranks Pack, whose notice it copies, and the pack's own page states the same terms. The whole pack is kept, with the download's SHA-256, in the private asset repository. A build with the opponents' portraits, below, draws a face only where a portrait does not load.

## Splash

The launch splash is drawn at build time by `native/scripts/splash.mjs` and ships as one PNG. Its title is set in Titan One and the Fortemate name in Arimo Regular, both under the SIL Open Font License 1.1 and copied unchanged into `native/splash/fonts/` with their licences; `native/splash/README.md` records their sources and digests. The fonts themselves are not in the package. `@resvg/resvg-js` 2.6.2 renders the frame; it is a development dependency under MPL-2.0, its full licence stays in the installed package, and the application does not import it. The splash draws Thinkle from the private portrait pack (below) and three RhosGFX pieces (above); a build without the portraits draws a hat instead.

## Sounds

The game's sounds are vendored under `native/sounds/` from the private asset repository `fortemate/dicechess-assets`, at the commit recorded in `native/sounds/sounds.lock.json`, each pack beside its own manifest and licence file.

JDSherbert's licence requires visible credit, given on the About screen as "Sounds by JDSherbert" with the link jdsherbert.itch.io/tabletop-games-sfx-pack beneath it (the licence offers "Sounds by JDSherbert – https://jdsherbert.itch.io" as an example and calls a link optional), and it forbids sharing the raw files. The author, Josh Herbert, gave written permission on 24 September 2026 to include these four MP3 files in this public repository, with credit and a link to his page. That permission covers this project only: the files are not licensed under the AGPL, and using them anywhere else needs the author's permission or a copy of the pack from https://jdsherbert.itch.io/tabletop-games-sfx-pack. Kenney's packs are CC0 and carry no such limit; the About screen credits them as a courtesy.

## Music

The game's four music tracks are vendored under `native/music/` from the private asset repository `fortemate/dicechess-assets`, at the commit recorded in `native/music/music.json`, beside the pack's manifest and licence file (#76). They are Warm anticipation for the menus, and Clear Space, Tightening Layers and Tense Minor Pulse for the game.

The tracks were made by pepka-prygni with Suno, on the author's paid plan. On 26 September 2026 the author gave written permission to use them in this game, with the credit "Music by pepka-prygni" and a link to his YouTube channel, which the About screen shows. That permission covers this project only: the files are not licensed under the AGPL or any other open licence, and using them anywhere else needs the author's permission. `native/music/pepka-prygni-dicechess/LICENSE.txt` records the terms. Suno keeps a licence of its own to everything made with it, and requires its "made with suno" metadata to stay in every copy; the MP3 files keep it.

## Voices

Five voice packs are vendored under `native/voices/` from the private asset repository `fortemate/dicechess-assets`, all from the one commit recorded in `native/voices/voices.json`, each beside its own manifest and licence file. The bots' pack has one clip for each of the 63 lines in `src/core/botVoice.ts` (#159, #187). The three Hot Seat host packs have one clip for each of the lines in `src/core/hostScripts.ts`: 54 said by Prowla the cat (#258), 48 by Rolly (#202) and 54 by Thinkle the wizard (#279), each as the host of Hot Seat games. Three lines of each host are for castling (#279). The tutorial's pack has one clip for each of the 48 lines Thinkle the wizard says in `src/core/tutorial.ts` as he teaches it (#264) and offers it on a first launch (#244). The catalogue keeps the text each clip was recorded from.

They are synthetic voices, made for this game with ElevenLabs on a paid subscription. The owner designed a fairy-tale voice for each character with Voice Design, and Eleven v4 read every line; each host's lines are read in that host's own voice. The recordings are Fortemate's, licensed to Fortemate's Dice Chess applications only, on the same terms for every pack (`native/voices/elevenlabs-dicechess-bots/LICENSE.txt`, `native/voices/elevenlabs-dicechess-host/LICENSE.txt`, `native/voices/elevenlabs-dicechess-host-prowla/LICENSE.txt`, `native/voices/elevenlabs-dicechess-host-thinkle/LICENSE.txt` and `native/voices/elevenlabs-dicechess-tutorial-thinkle/LICENSE.txt`). They are not covered by the AGPL or by any other open licence. A fork or copy of this repository may not use, publish or distribute them, and must replace them with audio of its own. ElevenLabs asks for no credit on a paid plan; the About screen names ElevenLabs beside the engine, so that a player knows the voices are synthetic.

A sixth pack, Thinkle's narration of the demo video, is vendored under `scripts/demo-video/narration/` by `scripts/demo-video/vendor-narration.mjs`, from the commit recorded in its `narration.json`: 15 lines, heard in the video and never in the game. Its licence (`scripts/demo-video/narration/LICENSE.txt`) is the other packs', and also allows the videos that present Fortemate's Dice Chess applications.

Beside the packs, `native/voices/events.json` is copied from the same commit: Fortemate's own table of when a character speaks, the tiers and the pacing every Dice Chess client shares. `src/core/hostPacing.ts` is generated from it. It holds no audio, and its digest is recorded in `native/voices/voices.json`.

## Portraits

The characters' portraits, the opponents Rolly, Grabby and Rampage, Prowla the cat, who hosts Hot Seat games, and Thinkle the wizard, who teaches the tutorial, were drawn for this game with Recraft on a paid plan (fortemate/dicechess-assets#31). They are Fortemate's, licensed to Fortemate's Dice Chess applications only, as the `NOTICE.txt` that comes with them says. They are not covered by the AGPL or by any other open licence. A fork or copy of this repository may not use, publish or distribute them.

While this repository is public the portrait files are not in it. `native/scripts/vendor-portraits.mjs` copies them, with that notice and a lock, from the private asset repository `fortemate/dicechess-assets` into `native/portraits/`, which git ignores, and a build without them shows the RhosGFX faces in their place, and nothing in Prowla's or Thinkle's, who have no such face (`native/test/matchup.test.tsx` and `native/test/tutorial.test.tsx`: each place stays empty at the portrait's size when it does not load). In a build that has them, the About screen shows them beside Recraft's name, with the engine and the voices, so that a player knows they are AI-generated, and its RhosGFX card names only the pieces. In a build without them it credits the RhosGFX faces with the pieces.

The screenshots in `site/src/assets/screenshots/` show the portraits as the app draws them, and so does the demo video's picture there. Those pictures are Fortemate's as well and are not covered by the AGPL.

## Amazon platform packages

`native/` depends on `@amazon-devices/react-native-kepler`, `@amazon-devices/react-native-mmkv`, `@amazon-devices/react-native-svg`, `@amazon-devices/react-native-w3cmedia` and `@amazon-devices/kepler-performance-api` at runtime, and on `@amazon-devices/kepler-cli-platform` and `@amazon-devices/eslint-plugin-kepler` to build and lint. They install from the public npm registry under Amazon's Program Materials License Agreement and are not redistributed by this repository. A built package contains Amazon's MMKV native library, as every Vega app that uses it does, and the few lines of JavaScript in `kepler-performance-api` that report the fully drawn marker; the other runtime libraries are provided by the device. No additional permission under section 7 of the AGPL has been granted for these libraries.

The Vega SDK itself is licensed to each developer under Amazon's [Program Materials License Agreement](https://developer.amazon.com/support/legal/pml) and is deliberately not in this repository; what is committed is our own configuration. No Vega SDK material or Amazon sample code has been copied here.

## Removed

Chessground (GPL-3.0-or-later) and Svelte (MIT) were dependencies of the WebView probe, which was removed once the native board replaced it. Nothing in the application reaches them, and the GPL obligation Chessground carried no longer applies to anything that ships. `docs/` keeps the record of what the probe established.

## Brand

`native/brand/` holds Fortemate brand images, copied verbatim from the brand repository for the splash screen. The Fortemate name and logo are not licensed under the AGPL.

`native/icon/` holds the game icon, copied verbatim from Fortemate's asset repository with its `NOTICE.txt`. The icon is Fortemate's artwork and is not licensed under the AGPL. It contains two pieces from the RhosGFX Vector Chess Pieces Pack (Outline set), which are CC0 and credited above.

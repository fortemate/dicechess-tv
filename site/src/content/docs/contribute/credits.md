---
title: Credits and licences
description: Full licensing terms, asset provenance, open-source attributions, and third-party notices for Dice Chess TV.
sidebar:
  order: 4
---

Dice Chess TV combines open-source code with public domain and permitted creative assets, and with Fortemate's own character portraits and voices, which no open licence covers. This page details the licences governing every component of the application.

## Application & Core Engine

- **Dice Chess TV (`fortemate/dicechess-tv`):** Licensed under the [GNU Affero General Public License v3.0 only](https://www.gnu.org/licenses/agpl-3.0.html) (AGPL-3.0-only).
- **Rules Engine ([`@fortemate/dicechess-engine`](https://github.com/fortemate/dicechess-engine)):** Published on npm under AGPL-3.0-only.

## Artwork & Visual Assets

### Chess Pieces

- **Source:** [Vector Chess Pieces Pack](https://rhosgfx.itch.io/vector-chess-pieces) by **RhosGFX** (version 1.0.0).
- **Licence:** Dedicated to the public domain under Creative Commons [CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/).
- **Usage:** 12 vector SVG pieces (White and Black Outline variants) are compiled into inline JSX components (`native/src/pieces/`) for rendering via `@amazon-devices/react-native-svg`.

### Character portraits

- **Source:** Portrait pack 1.4.0, drawn for Dice Chess by Fortemate with [Recraft](https://www.recraft.ai) on a paid plan. The app shows five characters from it: the opponents Rolly, Grabby and Rampage, Prowla the cat, who hosts Hot Seat games, and Thinkle the wizard, who teaches the tutorial.
- **Licence:** Fortemate's own, for Fortemate's Dice Chess apps only. Not covered by the AGPL or by any other open licence. A fork or copy of this repository may not use, publish or distribute them.
- **Usage:** The opponent cards and the game screen show them, the Hot Seat host's beside the host's line. Thinkle's stands above his bubble in the tutorial and in its offer on a first launch, and the launch splash shows him in a large medallion, drawn at build time from his vector, which the game does not ship. While the repository is public the portrait files are kept out of it. A build without them shows the opponents' emoji faces below instead. Prowla and Thinkle have no such face, so their place stays empty, at the portrait's size. The About screen shows the portraits beside Recraft's name, with the engine and the voices, so that a player knows they are AI-generated. The screenshots on this site show them as the app draws them, and so does the demo video's picture. Those pictures are Fortemate's too, and not under the AGPL.

### Splash typography

- **Fonts:** [Titan One](https://github.com/google/fonts/tree/main/ofl/titanone) by Rodrigo Fuenzalida sets the title on the launch splash, and [Arimo](https://github.com/googlefonts/Arimo) by The Arimo Project Authors sets the Fortemate name beside the mark.
- **Licence:** SIL Open Font License 1.1, with each licence kept beside its font in `native/splash/fonts/`.
- **Usage:** Build time only. The splash is drawn once into a picture, so neither font is in the app.

### Opponent Bot Avatars

- **Source:** [Vector Emojis](https://rhosgfx.itch.io/vector-emojis) by **RhosGFX** (Outline set).
- **Licence:** Creative Commons [CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/).
- **Usage:** In a build without the portraits, three emojis represent the local computer opponents: _Zany face_ for Rolly (Easy), _Money mouth face_ for Grabby (Medium), and _Smiling face with horns_ for Rampage (Hard). The About screen then credits them with the pieces.

### Brand & App Icon

- **The Fortemate Name & Logo:** Copyright © Fortemate. All rights reserved. The Fortemate brand marks in `native/brand/` are not licensed under the AGPL.
- **The Application Icon:** Designed by Fortemate using two RhosGFX CC0 pieces (knight and rook) on a warm orange background. Copyright © Fortemate.

## Audio & Music

### Sound Effects

- **Kenney Game Assets:** Casino Audio, Interface Sounds, and Music Jingles by [Kenney](https://kenney.nl). Dedicated to the public domain under CC0 1.0 Universal.
- **Tabletop Games SFX Pack:** By [JDSherbert](https://jdsherbert.itch.io/tabletop-games-sfx-pack) (version 1.1.0).
  - The author, Josh Herbert, granted written permission on 24 September 2026 to include four MP3 files in this public repository with attribution.
  - _Terms:_ This permission applies exclusively to this project. The sound files are not licensed under the AGPL; using them elsewhere requires the author's permission. Credited in-game on the About screen.

### Adaptive Music

- **Composer:** [pepka-prygni](https://www.youtube.com/@genreexplorer-h5o) (version 0.2.0).
- **Tracks:** Four original themes composed with Suno:
  1. _Warm anticipation_ (Menus, tutorial, rules guide)
  2. _Clear Space_ (Game in progress — calm state)
  3. _Tightening Layers_ (Game in progress — tense state)
  4. _Tense Minor Pulse_ (Game in progress — critical danger)
- **Licence:** The author granted written permission on 26 September 2026 to include these tracks in Dice Chess TV with attribution. The files retain their embedded generation metadata. This permission applies exclusively to this project. Credited in-game on the About screen.

### Voices

- **Source:** Five voice packs, made for Dice Chess by Fortemate with [ElevenLabs](https://elevenlabs.io) on a paid plan. A fairy-tale voice was designed for each character.
  - The bots, Rolly, Grabby and Rampage (63 lines)
  - Rolly as the Hot Seat host (48 lines)
  - Prowla the cat as the Hot Seat host (54 lines)
  - Thinkle the wizard as the Hot Seat host (54 lines)
  - Thinkle the wizard, who teaches the tutorial and offers it on a first launch (48 lines)
- **Licence:** Fortemate's own, for Fortemate's Dice Chess apps only, on the same terms for every pack. Not covered by the AGPL or by any other open licence. A fork or copy of this repository may not use, publish or distribute them, and must replace them with audio of its own.
- **Usage:** The packs are vendored under `native/voices/`, each beside its own licence file. ElevenLabs asks for no credit on a paid plan, but the About screen names it beside the engine, so that a player knows the voices are synthetic.
- **Demo video:** A sixth pack, Thinkle's narration of the demo video, is vendored under `scripts/demo-video/narration/`: 15 lines, heard in the video and never in the game. Its licence is the other packs', and also allows the videos that present Fortemate's Dice Chess applications.

## Platform Dependencies & SDK

- **Amazon Vega Platform Packages:** Packages under `@amazon-devices/*` (e.g. `react-native-kepler`, `react-native-mmkv`, `react-native-svg`, `react-native-w3cmedia`, `kepler-performance-api`) are installed from the public npm registry under Amazon's Program Materials License Agreement.
- **Vega SDK:** The Amazon Vega SDK is licensed directly to each developer under Amazon's [Program Materials License Agreement](https://developer.amazon.com/support/legal/pml) and is not bundled or redistributed by this repository.

## Former Dependencies (Removed)

- **Chessground & Svelte:** Utilized during the initial feasibility probe on Vega SDK 0.23. Following WebView instability on SDK 0.24, the web probe was entirely removed. Neither Chessground (GPL-3.0-or-later) nor Svelte (MIT) is present in the shipping application, and no GPL obligations remain. Feasibility findings are archived in `docs/prototype.md`.

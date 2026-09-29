---
title: Credits and licences
description: Full licensing terms, asset provenance, open-source attributions, and third-party notices for Dice Chess TV.
sidebar:
  order: 4
---

Dice Chess TV combines open-source code with public domain and permitted creative assets. This page details the licences governing every component of the application.

## Application & Core Engine

- **Dice Chess TV (`fortemate/dicechess-tv`):** Licensed under the [GNU Affero General Public License v3.0 only](https://github.com/fortemate/dicechess-tv/blob/main/LICENSE) (AGPL-3.0-only).
- **Rules Engine ([`@fortemate/dicechess-engine`](https://github.com/fortemate/dicechess-engine)):** Published on npm under AGPL-3.0-only.

## Artwork & Visual Assets

### Chess Pieces

- **Source:** [Vector Chess Pieces Pack](https://rhosgfx.itch.io/vector-chess-pieces) by **RhosGFX** (version 1.0.0).
- **Licence:** Dedicated to the public domain under Creative Commons [CC0 1.0 Universal](https://github.com/fortemate/dicechess-tv/blob/main/licenses/RhosGFX-CC0.txt).
- **Usage:** 12 vector SVG pieces (White and Black Outline variants) are compiled into inline JSX components (`native/src/pieces/`) for rendering via `@amazon-devices/react-native-svg`.

### Opponent Bot Avatars

- **Source:** [Vector Emojis](https://rhosgfx.itch.io/vector-emojis) by **RhosGFX** (Outline set).
- **Licence:** Creative Commons [CC0 1.0 Universal](https://github.com/fortemate/dicechess-tv/blob/main/licenses/RhosGFX-Emojis-CC0.txt).
- **Usage:** Three emojis represent the local computer opponents: _Zany face_ for Rolly (Easy), _Money mouth face_ for Grabby (Medium), and _Smiling face with horns_ for Rampage (Hard).

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

## Platform Dependencies & SDK

- **Amazon Vega Platform Packages:** Packages under `@amazon-devices/*` (e.g. `react-native-kepler`, `react-native-mmkv`, `react-native-svg`, `react-native-w3cmedia`, `kepler-performance-api`) are installed from the public npm registry under Amazon's Program Materials License Agreement.
- **Vega SDK:** The Amazon Vega SDK is licensed directly to each developer under Amazon's [Program Materials License Agreement](https://developer.amazon.com/support/legal/pml) and is not bundled or redistributed by this repository.

## Former Dependencies (Removed)

- **Chessground & Svelte:** Utilized during the initial feasibility probe on Vega SDK 0.23. Following WebView instability on SDK 0.24, the web probe was entirely removed. Neither Chessground (GPL-3.0-or-later) nor Svelte (MIT) is present in the shipping application, and no GPL obligations remain. Feasibility findings are archived in `docs/prototype.md`.

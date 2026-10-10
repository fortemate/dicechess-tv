---
title: Project layout
description: Anatomy of the Dice Chess TV repository, explaining the pure core, native shell, scripts, test bench, and test suites.
sidebar:
  order: 2
---

The Dice Chess TV repository is structured into focused directories that separate pure rules logic, native presentation, tooling, and documentation.

```text
dicechess-tv/
├── src/core/            # Pure TypeScript game core (no React, no DOM)
├── native/              # React Native for Vega TV application
│   ├── src/             # Screens, board rendering, remote input, sound, storage
│   ├── scripts/         # Generators, vendoring, the splash, notices, install
│   └── test/            # Native board and component render tests
├── web/                 # Browser test bench for color-vision & remote evaluation
├── site/                # Astro Starlight project website & documentation
├── test/                # Root test suite (rules invariants, dice math, English test)
├── scripts/             # Press evaluator, voice catalogue, coverage, demo video
├── docs/                # Architecture records, specifications, and feasibility reports
├── licenses/            # Full-text licenses of third-party assets
├── THIRD_PARTY_NOTICES.md
├── CLA.md
└── LICENSE              # AGPL-3.0-only
```

## Directory Deep Dive

### 1. Pure TypeScript Core (`src/core/`)

Contains all platform-agnostic gameplay code. Enforced pure by `tsconfig.core.json`:

| File               | Responsibilities                                                                                     |
| ------------------ | ---------------------------------------------------------------------------------------------------- |
| `game.ts`          | Turn controller managing roll generation, move validation against the engine, and handoffs.          |
| `board.ts`         | Board geometry for the FEN board field: squares, files and ranks, with no renderer.                  |
| `boardView.ts`     | Pure projection converting game state into 64 `SquareView` records for the renderer.                 |
| `dice.ts`          | The three dice a turn shows: each face's piece, whether it is spent, and whether it will go unused.  |
| `cursor.ts`        | Directional jump navigation logic between active pieces and valid destinations.                      |
| `boardInput.ts`    | Maps abstract directional keys into target squares on the board, and finds the only choice for OK.   |
| `presses.ts`       | Counts the remote presses an action takes under each cursor strategy, for the press evaluator.       |
| `moveAnimation.ts` | Computes piece slide source/destination coordinates from move transitions.                           |
| `opponents.ts`     | Opponent configurations, difficulty descriptions, and card presentation data.                        |
| `bot.ts`           | Validates and applies engine bot paths for Rolly, Grabby, and Rampage.                               |
| `botVoice.ts`      | The bots' lines, with the events that trigger them and the pacing that keeps them from repeating.    |
| `hostVoice.ts`     | When the Hot Seat host speaks: the moments, one line a turn, the pacing and the shuffled bags.       |
| `hostScripts.ts`   | The three hosts' lines by event, copied word for word from the voice packs' catalogues.              |
| `hostPacing.ts`    | Generated from the shared `events.json`: how often the host speaks, as every Dice Chess client does. |
| `snapshotStore.ts` | Snapshot serialization contract and integrity validation.                                            |
| `keys.ts`          | A helper the decoders use to refuse a snapshot with a missing or an unexpected field.                |
| `danger.ts`        | King threat evaluation driving adaptive background music levels.                                     |
| `ledger.ts`        | Persistent win/draw/loss ledger with crash-resilient exactly-once accounting.                        |
| `tutorial.ts`      | Pure data and state machine for the 6 interactive tutorial lessons, with Thinkle's lines.            |
| `rules.ts`         | The rules guide's nine topics, each claim checked against the engine in `test/rules.test.ts`.        |
| `cues.ts`          | Computes audio cue triggers (move, capture, roll, victory) from board state diffs.                   |
| `credits.ts`       | The credits the About screen shows, held to `THIRD_PARTY_NOTICES.md` by `test/credits.test.ts`.      |

### 2. React Native for Vega Shell (`native/`)

Contains the TV presentation layer built with React Native for Vega:

| Path                          | Purpose                                                                                                     |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `src/App.tsx`                 | Root component initializing MMKV storage, audio managers, and settings.                                     |
| `src/GameScreen.tsx`          | Main screen housing the board, side status panel, menus, and dialogs.                                       |
| `src/Matchup.tsx`             | Matchup HUD: the bot's dialogue block or a badge per side; turn frame; the Hot Seat host.                   |
| `src/SpeechBubble.tsx`        | A line beside its speaker's portrait: 20 dp text, three rows for a bot, two for the host.                   |
| `src/useBotVoice.ts`          | Picks the bot's lines as the game moves and how long each stays on screen.                                  |
| `src/useHostVoice.ts`         | Picks the Hot Seat host's lines at the pauses and big moments, says them, and returns the one to show.      |
| `src/hostSetting.ts`          | Who hosts Hot Seat, Prowla (the default), Rolly, Thinkle or off, remembered across launches.                |
| `src/useTutorialVoice.ts`     | Says Thinkle's lines in the tutorial and its offer, one clip after another, under the Voices setting.       |
| `src/screen.ts`               | Pure state reducer coordinating menu navigation, confirmations, and gameplay flow.                          |
| `src/Board.tsx`               | 8x8 chessboard grid rendering pieces, square tints, focus rings, and move animations.                       |
| `src/Square.tsx`              | One square and its marks: last move, movable piece, piece in hand, destinations and the cursor.             |
| `src/Dice.tsx`                | Three-dice tray with tumbling roll animations and dimmed unplayable dice.                                   |
| `src/OpponentScreen.tsx`      | Three opponent cards, each with its face, level and how it plays; the hint says what OK does under Play as. |
| `src/Portrait.tsx`            | The characters' portraits, or an opponent's emoji face in a build without them.                             |
| `src/TutorialScreen.tsx`      | Interactive tutorial screen driving lessons on an isolated sandbox board.                                   |
| `src/TutorialOffer.tsx`       | The first launch's offer of the tutorial, made by Thinkle: Learn to play or Skip.                           |
| `src/tutorial.ts`             | The tutorial's flow, a pure function of state and one key, on the game's own board and controller.          |
| `src/Teacher.tsx`             | Thinkle beside the board, with his portrait and bubble, in the tutorial and its offer.                      |
| `src/RulesScreen.tsx`         | Dual-pane rules guide with topics on the left and explanations on the right.                                |
| `src/AboutScreen.tsx`         | Project credits and third-party license notices accessible via TV remote.                                   |
| `src/Option.tsx`              | One item of a menu or the rules guide: framed and filled when focused, pressed while OK is held.            |
| `src/Recovery.tsx`            | What the player sees if the game screen fails: a way back that keeps the saved game.                        |
| `src/useRemoteInput.ts`       | Subscribes to Vega input events and normalizes keys (`enter`, `kpenter`, `select`, `back`).                 |
| `src/mmkvStore.ts`            | Synchronous snapshot and preferences store backed by MMKV.                                                  |
| `src/soundSetting.ts`         | Whether the sound effects play, remembered across launches.                                                 |
| `src/musicSetting.ts`         | Whether the music plays and how loud, remembered across launches.                                           |
| `src/voiceSetting.ts`         | The Voices setting: whether every line is spoken aloud, remembered across launches.                         |
| `src/playAsSetting.ts`        | The colour played against the computer: Random (the default), White, Black or Ask.                          |
| `src/turnSetting.ts`          | Whether the board turns to the side to move in a friend game, off by default.                               |
| `src/autoSelectSetting.ts`    | Whether OK presses itself on the only choice, off by default.                                               |
| `src/tutorialOfferSetting.ts` | Whether the first launch's offer of the tutorial has been answered.                                         |
| `src/activity.ts`             | One foreground gate for audio, remote input and the work scheduled between frames.                          |
| `src/randomSource.ts`         | Where the dice get their randomness on the device, chosen at runtime and named.                             |
| `src/sound.ts`                | Audio player managing sound effect playback across three concurrent audio sinks.                            |
| `src/music.ts`                | Adaptive music player managing crossfades between danger theme tracks.                                      |
| `src/useDanger.ts`            | Runs the danger search one roll at a time between frames, and gives the music its level.                    |
| `src/useReducedMotion.ts`     | Whether the platform asks for less motion, for the slides, the dice and the board's turn.                   |
| `src/cueFiles.ts`             | Generated by `vendor-sounds.mjs`: the vendored files each cue may play.                                     |
| `src/voiceFiles.ts`           | Generated by `vendor-voices.mjs`: each line's clip, its length and the text it was recorded from.           |
| `src/layout.ts`               | The safe area: the outer 5 % of each edge, which a television may crop.                                     |
| `src/theme.ts`                | The board's palette and the app's colours.                                                                  |
| `src/pieces/`                 | Generated SVG React components for all 12 chess pieces (RhosGFX CC0).                                       |
| `src/faces/`                  | Generated SVG React components for opponent bot avatars (RhosGFX CC0).                                      |

### 3. Build & Simulation Scripts

Automated tools for asset compilation and algorithmic measurement:

- **`npm run presses` (`scripts/cursor-presses.ts`):** Replays 200 random games to benchmark directional cursor jump efficiency against standard 2D grid stepping.
- **`npm run voices:catalogue` (`scripts/voice-catalogue.ts`):** Exports the bots' lines, with the commit they come from, for the voice generator in `dicechess-assets`.
- **`npm run coverage:native` (`scripts/coverage-native.ts`):** Runs each app test file in a process of its own with coverage, for SonarQube Cloud.
- **`scripts/demo-video/`:** Records the demo video's takes on the Virtual Device with `vvd`, then cuts and mixes it; its README lists the steps.
- **`native/scripts/generate-pieces.mjs`:** Compiles RhosGFX SVG chess pieces into inline JSX components compatible with `@amazon-devices/react-native-svg`.
- **`native/scripts/generate-faces.mjs`:** Compiles RhosGFX Vector Emoji SVGs into inline JSX components for bot opponent cards.
- **`native/scripts/rhosgfx-svg.mjs`:** Turns a RhosGFX SVG, whose styles `react-native-svg` cannot read, into inline JSX props for both generators.
- **`native/scripts/vendor-sounds.mjs`:** Copies pinned sound effects from `dicechess-assets` and verifies cryptographic SHA-256 hashes against `sounds.lock.json`.
- **`native/scripts/vendor-music.mjs`:** Copies pinned music tracks from `dicechess-assets` and writes `music.json`.
- **`native/scripts/vendor-voices.mjs`:** Copies the voice packs, the bots', each Hot Seat host's and the tutorial's, and `events.json` from one pinned commit of `dicechess-assets`, writes `voices.json`, `src/voiceFiles.ts` and `src/core/hostPacing.ts`, and keeps the text each clip was recorded from, so a changed line fails `vendoredVoices.test.ts`.
- **`native/scripts/vendor-portraits.mjs`:** Copies the portrait pack from one pinned commit of `dicechess-assets` into `native/portraits/`, which Git ignores while the repository is public.
- **`native/scripts/generate-assets.mjs`:** Rebuilds `native/assets/` afresh on each build, assembling `SplashScreenImages.zip`, launcher icons, sound files, music, voices, the portraits when present and the licence notices.
- **`native/scripts/splash.mjs`:** Draws the launch splash, Thinkle conjuring the dice, into PNG frames with resvg-js at build time.
- **`npm run notices --prefix native` (`native/scripts/notices.mjs`):** Writes, or checks, the notices of the npm packages the bundle ships, from the bundle's source map ([#338](https://github.com/fortemate/dicechess-tv/issues/338)).
- **`npm run device --prefix native` (`native/scripts/install.mjs`):** Installs the package built for the device's processor and, on request, launches it ([FL-30](/friction-log/#fl-30)).

### 4. Test Suites

- **`test/` (Root Suite):** tests of the pure game rules, engine contracts, dice math, the danger search, the ledger and the English-only repository check (`test/english.test.ts`).
- **`native/test/` (Native Suite):** tests of component rendering, focus, safe area padding, reduced motion, and the sound, music and voice players, against stubs of the Vega packages.
- **`web/test/` (Web Bench):** tests of the browser test bench's configuration and board marks.

Current counts are on [How we test and review](/quality/).

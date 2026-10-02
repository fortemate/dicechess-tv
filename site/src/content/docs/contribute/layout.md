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
│   ├── scripts/         # Piece/face generators, sound/music vendoring
│   └── test/            # Native board and component render tests
├── web/                 # Browser test bench for color-vision & remote evaluation
├── site/                # Astro Starlight project website & documentation
├── test/                # Root test suite (rules invariants, dice math, English test)
├── scripts/             # Root simulation scripts (cursor presses evaluator)
├── docs/                # Architecture records, specifications, and feasibility reports
├── licenses/            # Full-text licenses of third-party assets
├── THIRD_PARTY_NOTICES.md
├── CLA.md
└── LICENSE              # AGPL-3.0-only
```

## Directory Deep Dive

### 1. Pure TypeScript Core (`src/core/`)

Contains all platform-agnostic gameplay code. Enforced pure by `tsconfig.core.json`:

| File               | Responsibilities                                                                            |
| ------------------ | ------------------------------------------------------------------------------------------- |
| `game.ts`          | Turn controller managing roll generation, move validation against the engine, and handoffs. |
| `boardView.ts`     | Pure projection converting game state into 64 `SquareView` records for the renderer.        |
| `cursor.ts`        | Directional jump navigation logic between active pieces and valid destinations.             |
| `boardInput.ts`    | Maps abstract directional keys into target squares on the board.                            |
| `moveAnimation.ts` | Computes piece slide source/destination coordinates from move transitions.                  |
| `opponents.ts`     | Opponent configurations, difficulty descriptions, and card presentation data.               |
| `bot.ts`           | Validates and applies engine bot paths for Rolly, Grabby, and Rampage.                      |
| `snapshotStore.ts` | Snapshot serialization contract and integrity validation.                                   |
| `danger.ts`        | King threat evaluation driving adaptive background music levels.                            |
| `ledger.ts`        | Persistent win/draw/loss ledger with crash-resilient exactly-once accounting.               |
| `tutorial.ts`      | Pure data and state machine for the 5 interactive tutorial lessons.                         |
| `cues.ts`          | Computes audio cue triggers (move, capture, roll, victory) from board state diffs.          |

### 2. React Native for Vega Shell (`native/`)

Contains the TV presentation layer built with React Native for Vega:

| Path                     | Purpose                                                                                                          |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| `src/App.tsx`            | Root component initializing MMKV storage, audio managers, and settings.                                          |
| `src/GameScreen.tsx`     | Main screen housing the board, side status panel, menus, and dialogs.                                            |
| `src/Matchup.tsx`        | Matchup HUD: a badge per side, placed as on the board; turn frame; speech zone, and the host's face in Hot Seat. |
| `src/SpeechBubble.tsx`   | A line in a bubble, 20 dp text in at most two rows: up at the bot's badge, or left at the host's face.           |
| `src/useBotVoice.ts`     | Picks the bot's lines as the game moves and how long each stays on screen.                                       |
| `src/useHostVoice.ts`    | Picks the Hot Seat host's lines at the pauses and queues a line behind the one being said.                       |
| `src/hostSetting.ts`     | Hot Seat host toggle, on by default, remembered across launches.                                                 |
| `src/screen.ts`          | Pure state reducer coordinating menu navigation, confirmations, and gameplay flow.                               |
| `src/Board.tsx`          | 8x8 chessboard grid rendering pieces, square tints, focus rings, and move animations.                            |
| `src/Dice.tsx`           | Three-dice tray with tumbling roll animations and dimmed unplayable dice.                                        |
| `src/OpponentScreen.tsx` | Three-card opponent selection screen showing bot faces, difficulty, and player record.                           |
| `src/TutorialScreen.tsx` | Interactive tutorial screen driving lessons on an isolated sandbox board.                                        |
| `src/RulesScreen.tsx`    | Dual-pane rules guide with topics on the left and explanations on the right.                                     |
| `src/AboutScreen.tsx`    | Project credits and third-party license notices accessible via TV remote.                                        |
| `src/useRemoteInput.ts`  | Subscribes to Vega input events and normalizes keys (`enter`, `kpenter`, `select`, `back`).                      |
| `src/mmkvStore.ts`       | Synchronous snapshot and preferences store backed by MMKV.                                                       |
| `src/sound.ts`           | Audio player managing sound effect playback across three concurrent audio sinks.                                 |
| `src/music.ts`           | Adaptive music player managing crossfades between danger theme tracks.                                           |
| `src/pieces/`            | Generated SVG React components for all 12 chess pieces (RhosGFX CC0).                                            |
| `src/faces/`             | Generated SVG React components for opponent bot avatars (RhosGFX CC0).                                           |

### 3. Build & Simulation Scripts

Automated tools for asset compilation and algorithmic measurement:

- **`npm run presses` (`scripts/cursor-presses.ts`):** Replays 200 random games to benchmark directional cursor jump efficiency against standard 2D grid stepping.
- **`native/scripts/generate-pieces.mjs`:** Compiles RhosGFX SVG chess pieces into inline JSX components compatible with `@amazon-devices/react-native-svg`.
- **`native/scripts/generate-faces.mjs`:** Compiles RhosGFX Vector Emoji SVGs into inline JSX components for bot opponent cards.
- **`native/scripts/vendor-sounds.mjs`:** Copies pinned sound effects from `dicechess-assets` and verifies cryptographic SHA-256 hashes against `sounds.lock.json`.
- **`native/scripts/vendor-music.mjs`:** Copies pinned music tracks from `dicechess-assets` and writes `music.json`.
- **`native/scripts/vendor-voices.mjs`:** Copies both voice packs, the bots' and the Hot Seat host's, and `events.json` from one pinned commit of `dicechess-assets`, writes `voices.json`, `src/voiceFiles.ts` and `src/core/hostPacing.ts`, and keeps the text each clip was recorded from, so a changed line fails `vendoredVoices.test.ts`.
- **`native/scripts/generate-assets.mjs`:** Rebuilds `native/assets/` afresh on each build, assembling `SplashScreenImages.zip`, launcher icons, sound files, music and voices.

### 4. Test Suites

- **`test/` (Root Suite):** 172 tests covering pure game rules, engine contracts, dice math, danger search, ledger persistence, and the English-only repository check (`test/english.test.ts`).
- **`native/test/` (Native Suite):** 21 tests exercising component rendering, focus rings, safe area padding, motion reduction, and audio state transitions.

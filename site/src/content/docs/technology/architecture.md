---
title: Architecture
description: How Dice Chess TV separates its pure TypeScript core, the React Native for Vega shell, and the canonical rules engine.
sidebar:
  order: 1
---

Dice Chess TV has three layers: a TypeScript core with no platform dependencies, the React Native for Vega app, and Fortemate's open-source rules engine.

```mermaid
flowchart TB
  subgraph shell ["native/"]
    input("<b>useRemoteInput.ts</b><br/>D-pad · OK · Back · Menu")
    screen("<b>screen.ts</b><br/>screen reducer")
    store[("<b>mmkvStore.ts</b><br/>synchronous saves")]
    board("<b>Board.tsx</b><br/>draws the board")
    audio("<b>sound.ts · music.ts</b><br/>effects, music")
  end

  subgraph core ["src/core/"]
    nav("<b>boardInput.ts</b><br/>cursor jumps")
    game("<b>game.ts · bot.ts · snapshotStore.ts</b><br/>turns, opponents, saves")
    view("<b>boardView.ts · moveAnimation.ts</b><br/>squares, slides")
    cues("<b>cues.ts · danger.ts</b><br/>cues, king danger")
  end

  engine[["<b>@fortemate/dicechess-engine</b><br/>legal turn tree · applyMove · playable dice"]]

  input --> screen
  screen --> nav & game
  store --> game
  board --> view
  audio --> cues
  game & cues --> engine

  class core accent
```

Remote keys enter at the top, through `useRemoteInput.ts`. Every other arrow points from a module to the one it relies on, and all of them point down: the shell relies on the core and the core on the engine, and nothing in `src/core/` reaches back into `native/`.

## The Three Layers

### 1. The Pure TypeScript Core (`src/core/`)

The shared game logic lives at the repository root under `src/core/`. It contains no React components, no JSX, no DOM APIs, and no platform dependencies.

The core is kept pure by a check, not by convention. A second TypeScript configuration, `tsconfig.core.json`, typechecks it alone with `lib: ["ES2022"]` and `types: []`, so a reference to a browser global (`window`, `document`) or a Node global (`process`, `Buffer`) fails `npm run check`, which CI runs on every pull request.

Because the core needs nothing from a platform, the same turn controller runs in the Vega app, in the browser test bench (which draws `native/src/` through react-native-web) and directly under Node in the unit tests and `scripts/cursor-presses.ts`. No rule is written twice.

### 2. The React Native for Vega Shell (`native/`)

The native application under `native/` holds the screen flow, the drawing, the remote input, local saves, sound, and the random source and timers the screen flow uses:

- **Screen flow:** `screen.ts` is a reducer over the menus, the overlays, starting a game, the bot's steps and the settings. `App.tsx` gives it a random source for the dice and its timers.
- **Board and screens:** draws the 8x8 board, the dice, the menus, the dialogs, the tutorial, the rules guide and the opponent cards with React Native views. The pieces, on the board and on the dice, are drawn with `@amazon-devices/react-native-svg`, and so are the opponents' emoji faces, which a build without the portrait images shows in their place.
- **Remote input:** turns the D-pad, OK and Menu keys from `useTVEventHandler`, and Back from `useKeplerBackHandler`, into the board's own keys.
- **Synchronous persistence:** reads the saved game, the completed-game ledger and the settings from `@amazon-devices/react-native-mmkv` during the first render, so the first frame already has them.
- **Opponent search:** `botWorker.ts` queues requests for a custom Hermes worklet runtime. It runs the unchanged canonical `botReply` while the interactive runtime keeps serving keys. The native entry point supplies this runtime; the browser bench supplies a Web Worker.
- **Sound:** plays the sound effects, the spoken lines and the music with `AudioPlayer` from `@amazon-devices/react-native-w3cmedia`. The music follows one of four themes, crossfading when it changes: the menu theme, or over a game the theme for the danger to the king.

The native app makes no decisions about move legality, dice spending or how a game ends; those come from `src/core/` and the engine. The board it draws is the grid `src/core/boardView.ts` describes. Remote keys go straight to the screen reducer, except while the tutorial, the rules guide or About is open: those screens take the remote themselves.

### 3. The Canonical Engine (`@fortemate/dicechess-engine`)

Which actions and turns are legal is decided by Fortemate's open-source rules engine, published on npm as [`@fortemate/dicechess-engine`](https://github.com/fortemate/dicechess-engine). How a game ends is decided in `src/core/game.ts`. Besides a resignation or a draw agreed in a game between two people (Hot Seat in the code), it ends on its own as in Fortemate's game service: when a king is taken, after 100 halfmoves without a capture or a pawn move, checked at the end of a turn, or at turn 5,000.

The engine provides:

- Every legal turn of a roll, as a prefix tree of actions (`getLegalTurnTree`, engine 0.13.0).
- State transitions via `applyMove`, returning the remaining dice and board position.
- The dice some legal turn can still spend, via `getPlayableDice` (engine 0.14.0), so the others can be dimmed. `src/core/game.ts` answers from the turn tree where it can and asks the engine only when the tree does not settle it.

The app pins engine 0.14.6 ([#382](https://github.com/fortemate/dicechess-tv/pull/382)), which computes exact threat weights for up to three actions in the engine. Version 0.14.4 (October 6, 2026) builds the engine's move tables faster, which cut a cool start on a Fire TV Stick from 6.05 s to 2.65 s ([Performance](/technology/performance/#on-a-fire-tv-stick)).

## The Data Flow

A key press that plays a step goes through these stages. The bot's steps start at stage 2, from a timer.

1. **Remote Input:** `useRemoteInput` turns Vega's key events into the board's keys. The arrows, OK and Menu arrive through `useTVEventHandler`. OK is accepted under three names: `enter` (the Virtual Device's keyboard, and what Amazon staff say Vega OS 1.2 sends for a remote's OK, in [forum topic 28945](https://community.amazondeveloper.com/t/28945) on August 31, 2026), `kpenter` (the Virtual Device's on-screen remote) and `select` (the name a future Vega OS release will use). Back arrives through `useKeplerBackHandler`, the only channel that can claim it. The arrows, OK (as `enter` and `kpenter`) and Back were checked on the Vega Virtual Device, and Menu only by tests. On a Fire TV Stick 4K Select, a game has been played with the Stick's own remote ([Performance](/technology/performance/#response-to-the-remote)), and the arrows, OK and Back were checked with keys sent through `inputd-cli` ([Board selection algorithm](/design/board-selection/)); which of the three names the Stick sends for OK has not been recorded.
2. **Screen Reducer:** `screenReducer` in `native/src/screen.ts` takes the screen state and one action, such as a key or the bot's step, and returns the next state. It is not pure: it rolls the dice, makes game ids and draws a side through functions the app injects (a test injects fixed ones), and applies the bot's reply after the background worker resolves `options.reply`. A reply is matched to the game ID, revision and full DFEN, then its complete path is checked by `applyBotReply` before any move is shown. Directions move through menus, or jump the cursor between the pieces that can move and then between the chosen piece's destinations (`src/core/boardInput.ts`, `src/core/cursor.ts`).
3. **Turn Controller:** `src/core/game.ts` checks a roll for its phase and for three dice from 1 to 6, then has the engine build the turn tree for it. An action is accepted only if it is a next step in that tree, so a turn is checked as a whole. The bot's whole path is checked the same way before its first move is shown (`applyBotReply`).
4. **Engine Evaluation:** the engine's `applyMove` gives the new position with the dice still unspent, and the turn tree says which actions may follow. When none may, the turn is over. A roll that leaves no legal action goes straight to the handoff, and the screen says there are no legal moves. After each step, `game.ts` checks whether the game has ended.
5. **View Projection:** `Board.tsx` calls `boardView()` with the position's board field, the cursor, the selection, the legal actions, the last move, the movable pieces and which side the board is seen from. It returns an 8 x 8 grid of `SquareView` records: for each square, its piece, whether it is dark, and whether it is the cursor, the selected piece, a legal destination, an end of the last move or a piece that can move.
6. **Native Rendering & Motion:** `Board.tsx` draws the grid. When the position changed by one action, `src/core/moveAnimation.ts` works out which piece went from which square to which (two pieces for castling), and `Board.tsx` slides it there in 220 ms with React Native's `Animated` on the native driver. Nothing slides until React Native's `AccessibilityInfo` has answered whether reduced motion is on; where it cannot answer, pieces slide. Slides were checked frame by frame on the Vega Virtual Device; their smoothness on a Fire TV Stick has not been checked.
7. **Synchronous Persistence:** After React commits the render, an effect in `GameScreen.tsx` passes the new game to `onCommit` in `App.tsx`, which saves it through `mmkvStore.ts`: the snapshot is validated and written synchronously to MMKV. The save does not wait for the slide to finish.
8. **Audio Cues:** in the same effect, `cues()` names the step's sounds (a move, a capture, a roll, a win, and so on) and `sound.ts` plays them. Separately, once per turn, `useDanger.ts` measures the danger in `src/core/danger.ts`, whole, in one `setTimeout(0)` after the frame that shows the new turn; its answer (calm, tense or critical) sets the music theme, which rises at once and falls one level per turn. The measure looks up to three actions deep using the engine's `threatWeight`, a few dozen engine calls at most, so nothing is left to run while the turn is played. Without music it only checks for critical, for the opponent's threat line, and in Hot Seat it does not run ([Performance](/technology/performance/#danger-evaluation--threat-analysis)).

## Hackathon Scope vs Existing Foundation

What was built during the hackathon, and what existed before it:

| Component                                          | Status       | Origin                                                                                                                                                                                                                                                                                                                                                                                 |
| -------------------------------------------------- | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Rules Engine (`@fortemate/dicechess-engine`)**   | Pre-existing | Open-source npm package that existed before the hackathon. The legal turn tree for JavaScript clients and `applyMove` keeping unspent dice (0.13.0, September 26, 2026) and `getPlayableDice` (0.14.0, September 29, 2026), which this app relies on, were added to it during the hackathon, and so was a faster start (0.14.4) and exact threat weights up to three actions (0.14.6). |
| **Fire TV Application (`native/`)**                | New          | Written during the hackathon, starting from the Vega SDK's `helloWorld` project template, in a repository started on September 21, 2026.                                                                                                                                                                                                                                               |
| **Pure TypeScript Core (`src/core/`)**             | New          | Written during the hackathon for this app. It served the WebView probe and the native app until the probe was removed on September 23, 2026; now the native app, the browser test bench and the Node tests run it.                                                                                                                                                                     |
| **Remote Navigation Model (`src/core/cursor.ts`)** | New          | Directional jumps between the pieces that can move, then between the chosen piece's destinations: 61% fewer presses than square by square, over 200 simulated games in Node (`npm run presses`).                                                                                                                                                                                       |
| **Local Bot Opponents (`src/core/bot.ts`)**        | New          | Rolly, Grabby and Rampage as TV opponents, with cards showing each one's level and how it plays. Their moves come from the engine's existing algorithms (random, greedy, aggressive).                                                                                                                                                                                                  |
| **Interactive Tutorial & Rules Guide**             | New          | 6-lesson interactive tutorial taught by Thinkle the wizard and 9-topic remote-friendly rules guide.                                                                                                                                                                                                                                                                                    |
| **Animations & Audio**                             | New          | New code: a 220 ms piece slide, a 260 ms roll tumble, 10 sound cues, and music that follows the danger to the king (a menu theme and one theme for each of three danger levels). The sound effects (Kenney, JDSherbert) and the four music themes (pepka-prygni) are third-party work, used under their licenses or with their authors' permission.                                    |
| **Virtual Device driver (`vega-vvd-driver`)**      | New          | A separate, MIT-licensed repository started on September 27, 2026: a command, a Node library and an MCP server that press remote keys, take screenshots, record video and capture frames on the Vega Virtual Device through the Android emulator's gRPC API and console. It does not work with a Fire TV Stick, and this repository's CI does not use it.                              |

## Opponent Runtime on Vega

The app uses Amazon's [React Native Worklets API](https://developer.amazon.com/docs/vega-api/0.24/react-native-worklets), supported on React Native 0.83. `createWorkletRuntime` creates an isolated Hermes runtime and `runOnRuntime` schedules its work on a separate queue. `runOnJS` brings the serialized result back to the interactive runtime. The worklet does not import React Native views, storage or audio.

`scripts/botBundle.mjs` bundles the pure `botJob.ts` request handler and the canonical engine into `assets/raw/bot-engine.js`. The asset comes from the signed application package. On its first request, the worker evaluates this bundled code in its own runtime and retains that engine for later requests. It never evaluates code from a network response or player input. The build retains the engine source map alongside the app's debugging artifacts.

The worker calls the same `DiceChess.getBestMove` with the same algorithm. It changes where computation runs; it introduces no search deadline or weaker fallback. The client has a transport timeout for a missing response. That failure reaches the existing recovery screen, preserves the save and stops that client from launching overlapping work. It never retries the search on the UI thread.

Requests run one at a time. The client owns a bounded pair of namespaced default-MMKV keys; only the interactive runtime reads or writes them. The worklet receives and returns JSON strings. A callback checks that its request still owns the mailbox before publishing. Leaving the game for a menu retains its pending reply and presentation wait. A response received while the app is away cannot move the board until focus returns. Starting another game discards the old game's answer. Completion and disposal remove the mailbox without changing the game, ledger or settings keys.

A single `setTimeout(0)` around a synchronous search only postpones the freeze. Slicing would require a resumable engine API and a defined work budget across slices; the engine currently offers a complete synchronous call. Worklets use that existing API, at the cost of a second runtime and an engine asset. The browser bench uses a Web Worker with the same pure request handler. Browser evidence is separate from Vega evidence.

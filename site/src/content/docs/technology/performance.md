---
title: Performance
description: What has been measured of the app's launch, its opponents, the danger search and the animations; the launch on a Fire TV Stick, the rest on the Vega Virtual Device and in Node.
sidebar:
  order: 3
---

This page sets out what has been measured of the app's launch, its opponents, its animations and the danger search behind the music, and what each figure rests on.

Each measured figure says where it was measured: on a Fire TV Stick 4K Select (Vega OS 1.2), on the Vega Virtual Device (SDK 0.24.12112, 1920 x 1080, on an Apple silicon Mac) or in Node. Only the launch has been measured on the Stick so far, and the Virtual Device's timings are not a Stick's: the launch section shows how far apart they can be.

## Launch Key Performance Indicators (KPIs)

Amazon's [Measure App KPIs](https://developer.amazon.com/docs/vega/0.24/measure-app-kpis.html) page for Vega 0.24 gives launch guidelines: time to first frame (TTFF) under 1.5 s for a cool start and under 0.5 s for a warm one, and time to fully drawn (TTFD) under 8.0 s cool and under 1.5 s warm.

The app reports the fully drawn marker with `useReportFullyDrawn` from `@amazon-devices/kepler-performance-api`: once after its first render, which already shows the home screen, and again each time it comes back to active from the background or inactive state, which is a warm start. The OS measures time to first frame without a marker.

### On a Fire TV Stick

Measured on a Fire TV Stick 4K Select (Vega OS 1.2) on 6 October 2026 with `vega exec perf kpi-visualizer` on a Release build, without `--certification`. Each figure is the median of 10 launches, counting those the tool recorded a value for. Between the two columns the app moved from engine 0.14.0 to 0.14.4 and gained two small interface changes, to the key hints and the default Hot Seat host; with the 0.14.4 engine swapped into the earlier commit alone, a cool start took 2.63 s to fully drawn.

| Metric                          | Engine 0.14.0                     | Engine 0.14.4                        | Amazon guideline |
| ------------------------------- | --------------------------------- | ------------------------------------ | ---------------- |
| Cool start, time to first frame | 515 ms (2 launches)               | 412 ms (9 launches)                  | < 1.5 s          |
| Cool start, time to fully drawn | 6.05 s (10 launches, 5.62–6.77 s) | **2.65 s** (9 launches, 2.57–2.82 s) | < 8.0 s          |
| Warm start, time to first frame | 454 ms (9 launches, 295–658 ms)   | 413 ms (10 launches, 306–744 ms)     | < 0.5 s          |

The first frame of a cool start is the system's splash screen; the app's own first frame, the home screen, comes with fully drawn. A warm start's first frame is within the guideline at the median, but 4 of the 10 warm starts with engine 0.14.4 took longer than 0.5 s. The tool recorded no fully drawn time for a warm start, so the warm-start runs ended in `VALUE VALIDATION FAILED`; the cool-start runs passed its validation.

**Why the cool start took 6 s.** A trace of the launch showed one task of 4.0–4.5 s on the JavaScript thread before the app's first frame, and timing marks in a throwaway build put 3.46 s of it in a single engine call. Reading the saved game checks its turn with `DiceChess.applyMove`, the launch's first engine call that generates a sliding piece's moves, and with engine 0.14.0 that call built the engine's magic bitboard tables: a ray walk for each of their 107 648 entries. Hermes, the JavaScript engine of React Native for Vega, runs without a JIT, which is why that took seconds on the Stick. Engine 0.14.4 builds the same tables, byte for byte, from the two lines through each square ([dicechess-engine#331](https://github.com/fortemate/dicechess-engine/pull/331)), and the cool start fell to 2.65 s. The warm start did not change, as expected: the tables are built once per process. What the remaining 2.65 s of a cool start are spent on has not been broken down yet.

### On the Vega Virtual Device

Measured on the Vega Virtual Device on 25 September 2026 with `vega exec perf kpi-visualizer --kpi cool-start-latency` on a Release build: the average of 3 cool starts, without `--certification`.

| Metric                     | Measured (Virtual Device, 25 Sep 2026) | Amazon guideline, cool start |
| -------------------------- | -------------------------------------- | ---------------------------- |
| Time to first frame (TTFF) | 309 ms                                 | < 1.5 s                      |
| Time to fully drawn (TTFD) | 748 ms                                 | < 8.0 s                      |

The run still ended in `VALUE VALIDATION FAILED`, because the validator counts an app with no network calls as a failure ([FL-20](/friction-log/#fl-20)). Warm start cannot be measured on the Virtual Device ([FL-21](/friction-log/#fl-21)); it was measured on the Stick instead, and unit tests cover the warm-start report (`native/test/soundApp.test.tsx`). These figures predate the music, the voices and the portraits, and have not been re-measured since.

### What the start does not wait for

1. **No network calls.** The app makes none, at launch or later: no sign-in, no telemetry, no remote assets. Its only `fetch` reads the music catalogue from its own package (`file://`).
2. **Synchronous reads.** Game state, the record of completed games and the settings are stored in `@amazon-devices/react-native-mmkv`. MMKV memory-maps the data file, so they are read synchronously during the first render. On the Stick, reading and parsing the saved game took about a millisecond; the engine call that checks its turn is what the launch waited for with engine 0.14.0 (above).
3. **No loading state.** The saved game and the settings are there before the first frame, so the app draws no spinner or splash of its own, and its first frame is the home screen, ready for the remote. On the Virtual Device, an earlier version that rendered nothing until it had read storage never received remote input ([FL-07](/friction-log/#fl-07)).

## Opponents' decision time

Dice Chess TV offers three built-in opponents: Rolly (random), Grabby (greedy capture) and Rampage (aggressive king hunter). Each is an algorithm of the engine, asked for a whole turn through `getBestMove`, and all three run on the device, on the JavaScript thread.

A probe build on the Vega Virtual Device timed Grabby's and Rampage's decisions on 26 September 2026, and Node timed 100 games of each. The figures are the slowest seen, not bounds:

| Opponent    | How it plays                                         | Slowest in Node (100 games) | Slowest on the Virtual Device                 | Wait before each step |
| ----------- | ---------------------------------------------------- | --------------------------- | --------------------------------------------- | --------------------- |
| **Rolly**   | Any legal turn, at random                            | not timed                   | not timed                                     | 600 ms                |
| **Grabby**  | Takes the most valuable piece it can                 | 48 ms                       | 155 ms, over 14 turns                         | 600 ms                |
| **Rampage** | Hunts pieces, pushes its pawns and goes for the king | 38 ms                       | 339 ms, over about two games, on a first roll | 600 ms                |

### Pacing

Each step of the opponent's turn (the roll, each action, the handoff) waits 600 ms (`BOT_STEP_MS` in `native/src/screen.ts`), so a player can follow it from the sofa. The wait comes first. At the step of its first action, the opponent then decides its whole turn at once, on the JavaScript thread, so the decision time adds to that step: Rampage's slowest decision on the Virtual Device, 339 ms, added about a third of a second to it. No separate thread is used.

How to run a stronger opponent off the JavaScript thread is open ([FL-13](/friction-log/#fl-13)): React Native has no Web Worker, an app has no documented way to start a Vega headless task, and `@amazon-devices/react-native-worklets` is an untested candidate.

## Danger Evaluation & Threat Analysis

The music follows the danger to a king. At the start of each turn, `src/core/danger.ts` measures how close a side is to taking the other's king, and the music plays a calm, tense or critical theme, moving up at once and down one level per turn. Against the computer it measures the danger to the person's king; in hotseat, the greater danger to either king.

- **Critical:** some roll would let the attacking side take the king with its first action. This takes one pseudo-legal move generation: a median of 0.08 ms over 61 engine positions, in a probe build on the Vega Virtual Device on 26 September 2026.
- **Tense:** at least 22 of the 216 ordered rolls (6 × 6 × 6) would let the attacking side take the king within its turn, in up to three actions. The search tries the 56 distinct rolls, each weighted by how many of the 216 it stands for, and stops once the answer is known.
- **Calm:** neither.

In the same probe, a search over the 56 rolls took a median of 427 ms and at most 1.6 s. That search stopped at the first roll able to take the king; the app's search counts rolls until the threshold is settled either way. A search that long, run at once, would hold up the JavaScript thread, so `useDanger.ts` advances the search one roll per step, each step scheduled with `setTimeout(step, 0)`, and a key press can be handled between steps. A key press that arrives during a step still waits for that roll's search to finish; how long one step takes has not been measured on its own. In play on the Virtual Device on 26 September 2026, a turn's search took 0.5–2 s of wall time from start to answer, and a critical answer 18–30 ms.

## UI Motion & Animation Performance

Every animation uses `Animated.timing` with React Native's native driver (`useNativeDriver: true`). React Native for Vega's [Animated](https://developer.amazon.com/docs/react-native-vega/0.83/animated.html) page says the native driver sends an animation to native code before it starts, so once it is running a busy JavaScript thread does not affect it. We have not tested that on its own.

| Animation            | Duration      | Implementation Details                                                                                                                                                                                                                                                       |
| -------------------- | ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Piece Move Slide** | **220 ms**    | Eased out, from the old square to the new one. On the Virtual Device on 27 September 2026, a knight's capture took 224 ms over 11 captured frames. A unit test keeps it at 300 ms or less, a ceiling the project chose; Amazon's Fire TV design guidelines give no duration. |
| **Dice Roll Tumble** | **260 ms**    | Each die turns and grows onto its face in 200 ms, starting 30 ms after the die on its left. A die no legal turn can spend dims once the tumble is over. On the Virtual Device on 29 September 2026, a roll took about 260 ms.                                                |
| **Menu Focus State** | No transition | The focused item is framed in cyan over a faint fill. While OK is held, it fills more strongly and is drawn at 97 % of its size. This is a style change, not an animation.                                                                                                   |

### Accessibility: Reduced Motion

`useReducedMotion.ts` asks `AccessibilityInfo.isReduceMotionEnabled` and listens for `reduceMotionChanged`. When the answer is yes, and until an answer arrives, pieces are drawn on their new squares without sliding, the dice appear without tumbling, and the board turns without fading. React Native for Vega 0.83's [AccessibilityInfo](https://developer.amazon.com/docs/react-native-vega/0.83/accessibilityinfo.html) page lists neither the query among its implemented methods nor the event among its events. On the Vega Virtual Device the query answers `false` and there is no setting to change it, so only unit tests cover the reduced-motion branch. Whether a Fire TV Stick offers the setting is not yet checked.

## Physical Device Verification Roadmap

The launch KPIs, cool and warm, have been measured on a Fire TV Stick 4K Select; every other device figure above comes from the Vega Virtual Device. On a Stick (32-bit `armv7`, models AFTCA002 and AFTCL001), these checks are still to come:

- Finding what the remaining 2.65 s of a cool start are spent on.
- Checking that a slide stays smooth, and timing the opponents' decisions and the danger search.
- Checking the safe area on a television with overscan, and whether the Stick offers a reduced-motion setting.

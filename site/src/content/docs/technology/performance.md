---
title: Performance
description: What has been measured of the app's launch, its response to the remote, its opponents, the danger search and the animations; the launch, the response to the remote and first observations of play on a Fire TV Stick, the rest on the Vega Virtual Device and in Node.
sidebar:
  order: 3
---

This page sets out what has been measured of the app's launch, its response to the remote, its opponents, its animations and the danger search behind the music, and what each figure rests on.

Each measured figure says where it was measured: on a Fire TV Stick 4K Select (Vega OS 1.2), on the Vega Virtual Device (SDK 0.24.12112, 1920 x 1080, on an Apple silicon Mac) or in Node. On the Stick, the launch and the response to the remote have been measured, and one session of play recorded how late the app's timers ran there (below). The Virtual Device's timings are not a Stick's: the launch section and that session show how far apart they can be.

## Launch Key Performance Indicators (KPIs)

Amazon's [Measure App KPIs](https://developer.amazon.com/docs/vega/0.24/measure-app-kpis.html) page for Vega 0.24 gives launch guidelines: time to first frame (TTFF) under 1.5 s for a cool start and under 0.5 s for a warm one, and time to fully drawn (TTFD) under 8.0 s cool and under 1.5 s warm.

The app reports the fully drawn marker with `useReportFullyDrawn` from `@amazon-devices/kepler-performance-api`: once after its first render, which already shows the home screen, and again each time it comes back to active from the background or inactive state, which is a warm start. The OS measures time to first frame without a marker.

### On a Fire TV Stick

Measured on a Fire TV Stick 4K Select (Vega OS 1.2) on October 6, 2026, with `vega exec perf kpi-visualizer` on a Release build, without `--certification`. Each figure is the median of 10 launches, counting those the tool recorded a value for. Between the two columns the app moved from engine 0.14.0 to 0.14.4 and gained two small interface changes, to the key hints and the default Hot Seat host; with the 0.14.4 engine swapped into the earlier commit alone, a cool start took 2.63 s to fully drawn.

| Metric                          | Engine 0.14.0                     | Engine 0.14.4                        | Amazon guideline |
| ------------------------------- | --------------------------------- | ------------------------------------ | ---------------- |
| Cool start, time to first frame | 515 ms (2 launches)               | 412 ms (9 launches)                  | < 1.5 s          |
| Cool start, time to fully drawn | 6.05 s (10 launches, 5.62–6.77 s) | **2.65 s** (9 launches, 2.57–2.82 s) | < 8.0 s          |
| Warm start, time to first frame | 454 ms (9 launches, 295–658 ms)   | 413 ms (10 launches, 306–744 ms)     | < 0.5 s          |

The first frame of a cool start is the system's splash screen; the app's own first frame, the home screen, comes with fully drawn. A warm start's first frame is within the guideline at the median, but 4 of the 10 warm starts with engine 0.14.4 took longer than 0.5 s. The tool recorded no fully drawn time for a warm start, so the warm-start runs ended in `VALUE VALIDATION FAILED`; the cool-start runs passed its validation.

**Why the cool start took 6 s.** A trace of the launch showed one task of 4.0–4.5 s on the JavaScript thread before the app's first frame, and timing marks in a throwaway build put 3.46 s of it in a single engine call. Reading the saved game checks its turn with `DiceChess.applyMove`, the launch's first engine call that generates a sliding piece's moves, and with engine 0.14.0 that call built the engine's magic bitboard tables: a ray walk for each of their 107 648 entries. Hermes, the JavaScript engine of React Native for Vega, runs without a JIT, which is why that took seconds on the Stick. Engine 0.14.4 builds the same tables, byte for byte, from the two lines through each square ([dicechess-engine#331](https://github.com/fortemate/dicechess-engine/pull/331)), and the cool start fell to 2.65 s. The warm start did not change, as expected: the tables are built once per process. What the remaining 2.65 s of a cool start are spent on has not been broken down yet.

### On the Vega Virtual Device

Measured on the Vega Virtual Device on September 25, 2026, with `vega exec perf kpi-visualizer --kpi cool-start-latency` on a Release build: the average of 3 cool starts, without `--certification`.

| Metric                     | Measured (Virtual Device, 25 Sep 2026) | Amazon guideline, cool start |
| -------------------------- | -------------------------------------- | ---------------------------- |
| Time to first frame (TTFF) | 309 ms                                 | < 1.5 s                      |
| Time to fully drawn (TTFD) | 748 ms                                 | < 8.0 s                      |

The run still ended in `VALUE VALIDATION FAILED`, because the validator counts an app with no network calls as a failure ([FL-20](/friction-log/#fl-20)). Warm start cannot be measured on the Virtual Device ([FL-21](/friction-log/#fl-21)); it was measured on the Stick instead, and unit tests cover the warm-start report (`native/test/soundApp.test.tsx`). These figures predate the music, the voices and the portraits, and have not been re-measured since.

### What the start does not wait for

1. **No network calls.** The app makes none, at launch or later: no sign-in, no telemetry, no remote assets. Its only `fetch` reads the music catalog from its own package (`file://`).
2. **Synchronous reads.** Game state, the record of completed games and the settings are stored in `@amazon-devices/react-native-mmkv`. MMKV memory-maps the data file, so they are read synchronously during the first render. On the Stick, reading and parsing the saved game took about a millisecond; the engine call that checks its turn is what the launch waited for with engine 0.14.0 (above).
3. **No loading state.** The saved game and the settings are there before the first frame, so the app draws no spinner or splash of its own, and its first frame is the home screen, ready for the remote. On the Virtual Device, an earlier version that rendered nothing until it had read storage never received remote input ([FL-07](/friction-log/#fl-07)).

## Response to the remote

Measured on a Fire TV Stick 4K Select (Vega OS 1.2) on October 9, 2026, on Release builds from just before and just after the board was memoized ([#326](https://github.com/fortemate/dicechess-tv/pull/326)). Before, every render of the game screen, for a key, an opponent's step, a timer or a danger update, drew the board's 64 squares and every piece again. Since then the board, its squares and the pieces skip a render when their inputs have not changed, so a cursor move draws only the two squares it leaves and reaches. The keys were sent with `inputd-cli`, 1.3 s apart, in a game against Grabby with the music on.

| Per cursor move                                                                                | Before                               | After                                  |
| ---------------------------------------------------------------------------------------------- | ------------------------------------ | -------------------------------------- |
| Key to the frame that shows it (the OS's `last_input_to_frame_latency`, from a Perfetto trace) | median 152 ms (139–166 ms, 9 moves)  | median **59 ms** (45–125 ms, 13 moves) |
| JavaScript time of the renders it caused                                                       | median 110 ms (102–132 ms, 22 moves) | median **24 ms** (20–51 ms, 23 moves)  |

The JavaScript times come from instrumentation added to both builds for the measurement and never committed: it timed each commit from its first render to its last layout effect. On the second build, about four minutes of a game played with the Stick's own remote gave a median of 28 ms per cursor move. The JavaScript times leave out how long a key can wait behind the danger search or the opponent's search on the JavaScript thread, which the change did not touch.

### Working out each state of a game once

A view of the game, the position with what may come next and the dice left, was worked out by replaying every action played so far in the turn, one engine call each, and a single key asked for it five times or more. Four of the five views behind an arrow only wanted to know whose turn it was. So the further a turn went, the more each key cost. Since [#367](https://github.com/fortemate/dicechess-tv/issues/367), whose turn it is comes from the position the turn started from, and each state of a turn is replayed once and its view kept for the rest of the roll.

The figures are medians, about 30 keys each, from Release builds against Rolly with auto-select off; the keys were sent with `inputd-cli` on the Stick and with `vvd` on the Virtual Device. Instrumentation added for the measurement and never committed timed each key from the game screen's first render to its layout effect, which covers the reducer, the render and the commit, and the part of that spent working out views, in brackets.

On a Fire TV Stick 4K Select (Vega OS 1.2) on October 12, 2026, with music, sound effects and voices off:

| Key                                    | Actions played | Before              | After                 |
| -------------------------------------- | -------------- | ------------------- | --------------------- |
| Arrow, nothing picked up               | 0              | 20.4 ms (0.6 ms)    | 18.9 ms (0.1 ms)      |
| Arrow, nothing picked up               | 1              | 27.6 ms (10.3 ms)   | 20.2 ms (0.1 ms)      |
| Arrow, nothing picked up               | 2              | 26.9 ms (18.6 ms)   | 9.2 ms (0.1 ms)       |
| Arrow, with a piece in hand            | 0              | 19.8 ms (0.7 ms)    | 8.8 ms (0.1 ms)       |
| Arrow, with a piece in hand            | 1              | 22.4 ms (10.9 ms)   | 21.9 ms (0.1 ms)      |
| Arrow, with a piece in hand            | 2              | 37.0 ms (19.2 ms)   | 19.6 ms (0.1 ms)      |
| Pick up a piece                        | 1–2            | 52–55 ms (14–20 ms) | 39–44 ms (0.1 ms)     |
| Play an action                         | 1–2            | 91–92 ms (37–42 ms) | 58–69 ms (4.6–8.1 ms) |
| OK to hand the turn on, after 3 played | 3              | 50 ms (23 ms)       | 27 ms (0.1 ms)        |

On the Vega Virtual Device the same day, with sound effects and voices on:

| Key                         | Actions played | Before                  | After                   |
| --------------------------- | -------------- | ----------------------- | ----------------------- |
| Arrow, nothing picked up    | 0 / 1 / 2      | 2.33 / 2.56 / 2.66 ms   | 1.93 / 0.98 / 0.69 ms   |
| Arrow, with a piece in hand | 0 / 1 / 2      | 1.35 / 2.26 / 3.07 ms   | 1.99 / 1.96 / 1.96 ms   |
| Pick up a piece             | 1–2            | 4.1–4.7 ms (1.0–1.8 ms) | 3.4–3.7 ms (0.02 ms)    |
| Play an action              | 1–2            | not read                | 5.2–5.3 ms (0.4–0.8 ms) |

Before the change an arrow worked out five views at every point of a turn, and a played action eight to eleven. After it, an arrow and a pick-up work out one, which is already kept and calls the engine not at all, and a played action replays the turn once, for the state it leads to (`native/test/replays.test.tsx` holds every key to that). On both devices an arrow in the middle of a turn now costs what one at the start of a turn does: on the Stick 9–22 ms, against 22–37 ms before. The rest of a key's time is rendering, which this change did not touch; it varies from about 8 to 22 ms between rows in both runs, so an arrow can still take a little over one frame at 60 frames a second. A roll did not get cheaper: most of its 90–110 ms on the Stick is building the roll's tree of legal turns, once per roll.

## Opponents' decision time

Dice Chess TV offers three built-in opponents: Rolly (random, with immediate king captures), Grabby (material gains across a complete turn) and Rampage (aggressive king hunter). Their [profiles](/play/opponents/) explain the current playing styles; the timings below describe the builds measured on the dates named. Each is an algorithm of the engine, asked for a whole turn through `getBestMove`, and all three run on the device. The current native app runs this call in a separate Hermes worklet runtime; the historical measurements below predate that change.

The playing-style descriptions rest on engine 0.14.8 source inspection and the Node tests in [`test/opponents.test.ts`](https://github.com/fortemate/dicechess-tv/blob/8453e173eb50899685148010e7047e908a3d577e/test/opponents.test.ts) and [`test/opponent-examples.test.ts`](https://github.com/fortemate/dicechess-tv/blob/8453e173eb50899685148010e7047e908a3d577e/test/opponent-examples.test.ts).

A probe build on the Vega Virtual Device timed Grabby's and Rampage's decisions on September 26, 2026, and Node timed 100 games of each. The figures are the slowest seen, not bounds:

| Opponent    | How it plays                                         | Slowest in Node (100 games) | Slowest on the Virtual Device                 | Wait before each step |
| ----------- | ---------------------------------------------------- | --------------------------- | --------------------------------------------- | --------------------- |
| **Rolly**   | Any legal turn, at random                            | not timed                   | not timed                                     | 600 ms                |
| **Grabby**  | Best material balance after the whole turn           | 48 ms                       | 155 ms, over 14 turns                         | 600 ms                |
| **Rampage** | Hunts pieces, pushes its pawns and goes for the king | 38 ms                       | 339 ms, over about two games, on a first roll | 600 ms                |

### Pacing

Each step of the opponent's turn (the roll, each action, the handoff) waits 600 ms (`BOT_STEP_MS` in `native/src/screen.ts`), so a player can follow it from the sofa. The search overlaps the first action's wait: the move appears when both are finished. A longer search shows the thinking indicator. The search runs in the [opponent runtime](/technology/architecture/#opponent-runtime-on-vega), leaving the interactive JavaScript runtime free to serve the remote. The game screen checks the full reply before showing its moves, one at a time. Menu/resume during the slow Rampage position was checked on a physical Fire TV Stick 4K Select with Release 1.0.3/build 51 on October 21, 2026, using automated remote events. This establishes that those controls worked in that session; input latency was not measured. The [validation record](https://github.com/fortemate/dicechess-tv/blob/main/docs/opponent-runtime-validation-480.md) separates this run from tests and Virtual Device evidence.

The wait is a JavaScript timer, so it runs late while other work holds the JavaScript thread. On a Fire TV Stick 4K Select on October 10, 2026, in games against Rolly, the opponent's steps came 1.2–1.5 s apart instead of 600 ms. The automatic OK on the only choice, which waits as long, came 0.68–1.25 s after the state it was scheduled from ([Board selection algorithm](/design/board-selection/#the-only-choice)). Both were read from a throwaway build that wrote the screen's state to the device log, while checking that feature ([#342](https://github.com/fortemate/dicechess-tv/pull/342)); they are observations from one session, not a controlled measurement.

The native app now uses a custom Hermes worklet runtime. The [architecture](/technology/architecture/#opponent-runtime-on-vega) describes the canonical engine asset, serialized requests, lifecycle handling and failure path. These changes preserve the canonical engine's algorithms and work budgets.

## Danger Evaluation & Threat Analysis

The music follows the danger to a king. At the start of each turn, `src/core/danger.ts` measures how close a side is to taking the other's king, and the music plays a calm, tense or critical theme, moving up at once and down one level per turn. Against the computer it measures the danger to the person's king; in Hot Seat, the greater danger to either king.

- **Critical:** some roll would let the attacking side take the king with its first action. This takes one pseudo-legal move generation: a median of 0.08 ms over 61 engine positions, in a probe build on the Vega Virtual Device on September 26, 2026.
- **Tense:** at least 22 of the 216 ordered rolls (6 × 6 × 6) would let the attacking side take the king within its turn, in up to three actions. The engine calculates the exact roll weight of all paths reaching the king in up to three actions via `DiceChess.threatWeight`, searching once for all rolls without dice.
- **Calm:** neither.

[Danger measure](/design/danger/) sets the measure out step by step, with a diagram and a worked example.

In the same probe, a search over the 56 rolls took a median of 427 ms and at most 1.6 s. That search stopped at the first roll able to take the king; the app's search counts rolls until the threshold is settled either way. A search that long, run at once, would hold up the JavaScript thread, so `useDanger.ts` advances the search one roll per step, each step scheduled with `setTimeout(step, 0)`, and a key press can be handled between steps. A key press that arrives during a step still waits for that roll's search to finish; how long one step takes has not been measured on its own. In play on the Virtual Device on September 26, 2026, a turn's search took 0.5–2 s of wall time from start to answer, and a critical answer 18–30 ms. On a Fire TV Stick 4K Select, in the session of October 10, 2026, described under [Pacing](#pacing), one turn's search took 12.4 s, and the pull request puts the late timers there down to work like it on the JavaScript thread.

The whole search runs only while music is heard: the music is on in Settings, and the build has the music ([#368](https://github.com/fortemate/dicechess-tv/issues/368)). Only the music tells tense from calm. The level has one other listener, the opponent's threat line, said on a critical turn against the computer. So without music, a game against the computer stops after the critical check, one move generation a turn, and Hot Seat runs no search at all. Music turned on in the middle of a turn measures that turn again at once. Until the search answers, the theme is the one for the level known without music, which in Hot Seat is calm.

On a Fire TV Stick 4K Select on October 12, 2026, a Release build with timing probes, never committed, measured the change; the keys were OK presses 1.75 s apart. With music off, 45 turn starts against Rolly and Rampage were each answered in one step of 1.2–3.6 ms, apart from the first engine call after launch, which took 0.7 s; 5 of them were critical. The opponent's 90 step timers fired a median 0.3 ms late, and at most 38 ms. Nine Hot Seat turns started no search. With music on at volume 1, a Hot Seat turn that needed the whole search took 52–53 steps and 7.0–9.8 s of work, its longest step 0.5–0.9 s, as before the change.

On the same Stick on October 13, 2026, with music on, a logging build, never committed, timed a new Hot Seat game. The search for its first turn took 100 steps and 22 s, and its first steps took 0.7–1.5 s each. The music's fades are driven by a 50 ms ticker on the same JavaScript thread. They moved one step a tick, so the crossfade from the menu theme into the game, meant to take 2 s, took about 12 s, and over 15 s in another run. Since [#376](https://github.com/fortemate/dicechess-tv/issues/376) the fades follow the clock. In two runs of the same logging build on top of that change, the search's steps still took 0.5–1.5 s, and the crossfade was done 2.6 s and 2.9 s after OK: at the first tick after its two seconds. The theme then reached its full level about 6.5 s after OK, once the host's greeting had ended and the music had come back up from under it. These runs were made while the Stick's `/tmp`, a RAM disk, held about 470 MB of packages left there by earlier installs, half of its 1 GB of memory: `vega device install-app` copies each package there and does not remove it. With them removed, a fresh music player was heard 0.33 s after it started rather than 1.2–1.4 s, and in a game against Grabby resumed from the menu the search's first steps took 0.4–0.9 s. The crossfade now starts once the new theme's player is heard, and the theme being left plays on at its level until then; there the crossfade was done 2.4–3.4 s after OK. Making the search's steps short enough is [#365](https://github.com/fortemate/dicechess-tv/issues/365).

That search no longer runs. On October 13, 2026, a CPU profile of the Stick, taken while playing, showed each key waiting for the search step in progress, a median of 0.8–0.9 s and up to 2.7 s, while a render took 21–26 ms. The owner chose a measure that looks two actions deep, once for all the rolls, over the same answer found more cheaply ([#365](https://github.com/fortemate/dicechess-tv/issues/365)). It runs whole, in one `setTimeout(0)` at the start of the turn, so nothing is worked out while the turn is played. In Node with `--jitless`, a stand-in for Hermes without a JIT, over 300 turn starts from games played with seeded dice, it took a median of 7.4 ms and at most 26 ms, with 58 engine calls (at most 112), against 854 ms and 3.6 s with 8,027 calls (at most 33,005) for the three-action search. A threat that needs all three actions is no longer heard as tense: 9 of those 300 turns, which the three-action search heard as tense, are calm. On the Stick, the same day, CPU profiles of the same length and the same key presses (OK, then the arrows, about half a second apart, music on) were taken before and after the change. In a game against Rampage, the JavaScript thread was busy 47 % of the time before and 12 % after. The danger work fell from 26.2 s, 33 steps of up to 2.7 s, to 0.72 s, 4 measures of 97–261 ms. Renders that had to wait for it fell from 18 of 58, a median of 0.8 s each, to 2 of 87, 0.14 s and 0.17 s. In Hot Seat, which measures both kings, busy time fell from 46 % to 10 %, and the longest measure took 359 ms. The profiler itself slows the thread: before the change its steps had a median of 714 ms, against 162 ms in the probe of October 12 without it. So these figures are upper bounds.

With engine 0.14.6 and [#382](https://github.com/fortemate/dicechess-tv/issues/382), the three-action threat measurement was restored using the engine's built-in `DiceChess.threatWeight`. In Node with `--jitless`, across the same 300 turn starts from games played with seeded dice, the three-action evaluation took a median of 12.2 ms and at most 30.4 ms (p90 19.8 ms) in a single engine call, compared to 854 ms (max 3.6 s) with 8,027 calls for the original JavaScript search. All 9 positions that were calm under the two-action measure are correctly heard as tense again.

## UI Motion & Animation Performance

Every animation uses `Animated.timing` with React Native's native driver (`useNativeDriver: true`). React Native for Vega's [Animated](https://developer.amazon.com/docs/react-native-vega/0.83/animated.html) page says the native driver sends an animation to native code before it starts, so once it is running a busy JavaScript thread does not affect it. We have not tested that on its own.

| Animation            | Duration      | Implementation Details                                                                                                                                                                                                                                                        |
| -------------------- | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Piece Move Slide** | **220 ms**    | Eased out, from the old square to the new one. On the Virtual Device on September 27, 2026, a knight's capture took 224 ms over 11 captured frames. A unit test keeps it at 300 ms or less, a ceiling the project chose; Amazon's Fire TV design guidelines give no duration. |
| **Dice Roll Tumble** | **260 ms**    | Each die turns and grows onto its face in 200 ms, starting 30 ms after the die on its left. A die no legal turn can spend dims once the tumble is over. On the Virtual Device on September 29, 2026, a roll took about 260 ms.                                                |
| **Menu Focus State** | No transition | The focused item is framed in cyan over a faint fill. While OK is held, it fills more strongly and is drawn at 97 % of its size. This is a style change, not an animation.                                                                                                    |

On a Fire TV Stick, testers saw a roll's first die tumble in at once and the other two after a pause, together. Each die's tumble used to start after a `delay` of 30 ms per die, and React Native 0.83 waits out an animation's delay with a JavaScript timer even on the native driver (`TimingAnimation.start()` in `react-native` 0.83.10), so a busy JavaScript thread held the dice back. Since [#306](https://github.com/fortemate/dicechess-tv/pull/306) the three tumbles start together and each die's wait is part of its easing, so the native driver plays all of it. The owner played that build on the Stick on October 9, 2026, and reported that it works; there is no frame capture from the Stick. The Virtual Device never showed the fault.

### Accessibility: Reduced Motion

`useReducedMotion.ts` asks `AccessibilityInfo.isReduceMotionEnabled` and listens for `reduceMotionChanged`. When the answer is yes, and until an answer arrives, pieces are drawn on their new squares without sliding, the dice appear without tumbling, and the board turns without fading. React Native for Vega 0.83's [AccessibilityInfo](https://developer.amazon.com/docs/react-native-vega/0.83/accessibilityinfo.html) page lists neither the query among its implemented methods nor the event among its events. On the Vega Virtual Device the query answers `false` and there is no setting to change it, so only unit tests cover the reduced-motion branch. Whether a Fire TV Stick offers the setting is not yet checked.

## Physical Device Verification Roadmap

The launch KPIs, cool and warm, and the response to a cursor key have been measured on a Fire TV Stick 4K Select, the dice's stagger was checked there by eye, and one session of play gave first observations of the opponent's pace, the automatic OK and the danger search; every other device figure above comes from the Vega Virtual Device. On a Stick (32-bit `armv7`, models AFTCA002 and AFTCL001), these checks are still to come:

- Finding what the remaining 2.65 s of a cool start are spent on.
- Measuring the launch again on a build with the animated splash ([#293](https://github.com/fortemate/dicechess-tv/pull/293)) and engine 0.14.6: the launch figures above predate both.
- Checking that a slide stays smooth, and timing the opponents' decisions and the danger search in controlled runs: the Stick figures above for the opponent's pace and the danger search are first observations, not measurements.
- Checking the safe area on a television with overscan, and whether the Stick offers a reduced-motion setting.

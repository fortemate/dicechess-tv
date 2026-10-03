---
title: Performance
description: Measured launch latency, engine computation speed, animation timings, and platform KPIs on Vega OS.
sidebar:
  order: 3
---

Living-room gaming demands immediate responsiveness: games must launch promptly, remote clicks must provide instant visual feedback, and background calculations must never stutter animations or drop frames.

Every benchmark below was measured on the Vega Virtual Device (SDK 0.24.12112, 1080p, running on an Apple silicon Mac host) or in controlled Node.js test runs.

## Launch Key Performance Indicators (KPIs)

Amazon evaluates Fire TV apps against strict cold and warm start targets (e.g. cold start fully drawn under 8.0 s, warm start under 1.5 s).

Dice Chess TV integrates `@amazon-devices/kepler-performance-api` to report performance markers directly to the platform via `useReportFullyDrawn`. Measurements taken with `vega exec perf kpi-visualizer --kpi cool-start-latency` on a Release build:

| Metric                            | Measured Value | Platform Guideline | Assessment                         |
| --------------------------------- | -------------- | ------------------ | ---------------------------------- |
| **First Frame Latency**           | **309 ms**     | < 2,000 ms         | Instant startup                    |
| **Time To Fully Drawn**           | **748 ms**     | < 8,000 ms         | **10.7x faster** than Amazon limit |
| **Process Launch to First Event** | **227 ms**     | N/A                | Clean initialization               |

### Why Startup Is Fast

1. **Zero Network Calls:** The application makes zero remote network requests on startup. There are no remote auth handshakes, telemetry calls, or remote asset fetches.
2. **Synchronous Snapshot Loading:** Game state, player match records, and user preferences are stored in `@amazon-devices/react-native-mmkv`. MMKV memory-maps the data file, enabling synchronous reads during the initial render.
3. **No Intermediate Loading State:** Because state is available before the first frame paints, the app never renders an empty "spinner" or splash transition inside React. The UI draws the fully interactive home screen on its very first frame.

## Artificial Intelligence & Bot Decision Speed

Dice Chess TV offers three built-in opponents: Rolly (random), Grabby (greedy capture), and Rampage (aggressive king hunter). All three run locally on the main JavaScript thread.

To ensure the remote never feels laggy, bot decisions were measured across multiple games:

| Opponent    | Algorithm Type                  | Node.js Baseline | Vega Virtual Device (Release)       | Turn Pacing Step |
| ----------- | ------------------------------- | ---------------- | ----------------------------------- | ---------------- |
| **Rolly**   | Uniform random legal path       | < 5 ms           | < 15 ms                             | 600 ms           |
| **Grabby**  | Highest-value capture heuristic | 48 ms            | 155 ms (slowest of 14 turns)        | 600 ms           |
| **Rampage** | King hunt & piece aggression    | 38 ms            | 339 ms (worst case on initial roll) | 600 ms           |

### Evaluation Pacing

Bot turns are paced with a 600 ms delay between individual actions (`BOT_STEP_MS`), allowing the human player to follow each move from the sofa. Even Rampage's worst-case decision time (339 ms on a complex first-turn branching tree) completes well within the 600 ms step window, requiring no background worker threads for these heuristics.

If deeper minimax or neural network engines are introduced in the future, candidate off-thread architectures include `@amazon-devices/react-native-worklets`.

## Danger Evaluation & Threat Analysis

Adaptive background music dynamically adjusts its intensity based on the danger to the player's king:

- **Critical:** King can be captured with the very first action (computed via single move generation, taking **18–30 ms**).
- **Tense:** Evaluates whether any of the 216 possible three-dice combinations (`6 × 6 × 6`) can capture the king within the full turn.

A complete search across all 216 rolls took a median of 427 ms (up to 1.6 s in deep positions) on the virtual device. To prevent any frame drops or remote lag, `useDanger.ts` breaks this evaluation into incremental batches spread across animation frames. The user interface remains 100% responsive while danger is computed in the background.

## UI Motion & Animation Performance

All visual animations run entirely on the native UI thread via React Native's native driver (`useNativeDriver: true`):

| Animation            | Duration   | Implementation Details                                                                |
| -------------------- | ---------- | ------------------------------------------------------------------------------------- |
| **Piece Move Slide** | **220 ms** | Smooth translation between grid coordinates. Complies with 300 ms TV design limit.    |
| **Dice Roll Tumble** | **260 ms** | 200 ms tumble per die with a 30 ms left-to-right stagger. Dead dice dim as they land. |
| **Menu Focus State** | Instant    | Cyan border frame with 97% scale compression when held.                               |

### Accessibility: Reduced Motion

The application checks `AccessibilityInfo.isReduceMotionEnabled` via `useReducedMotion.ts`. When reduced motion is requested by the system or user, sliding animations and tumbling dice are instantly disabled, drawing pieces directly at their destinations.

## Physical Device Verification Roadmap

All measurements above reflect performance on the Vega Virtual Device. Physical testing on a Fire TV Stick (32-bit `armv7` architecture, models AFTCA002 and AFTCL001) is still to come:

- Verifying warm-start resume latency when returning from the Fire TV home launcher.
- Measuring CPU thermals and sustained 60 fps rendering during extended play sessions.
- Validating television overscan and color contrast in physical living-room lighting.

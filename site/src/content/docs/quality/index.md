---
title: How we test and review
description: Automated test suites, continuous integration, CodeQL security scanning, SonarCloud quality gate, CodeRabbit reviews, and virtual device automation.
sidebar:
  order: 1
---

Quality in Dice Chess TV is enforced through comprehensive automation: instant unit tests, continuous security analysis, strict quality gates, and automated emulator verification.

## The Test Suite

The repository maintains an automated test suite across two packages:

| Suite                                   | Scope                                                                                                                                                  | Runner & Environment                                                       | Count         | Duration    |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------- | ------------- | ----------- |
| **Core Suite** (`test/`)                | Turn controller, legal transitions, rules guide verification, snapshot store, opponent heuristics, dice math, danger search, English text enforcement. | Native Node.js test runner (`node:test`, `node:assert/strict`) with `tsx`. | **172 tests** | **~1.06 s** |
| **Native Shell Suite** (`native/test/`) | Board rendering, SVG piece layouts, D-pad jumping logic, input guards, focus states, audio ducking, motion reduced mode.                               | `react-test-renderer` with lightweight Vega stubs and esbuild.             | **21 tests**  | **~0.15 s** |
| **Total**                               | Full end-to-end logic & component tree verification                                                                                                    | Local dev & GitHub Actions CI                                              | **193 tests** | **~1.2 s**  |

### What the Tests Verify

- **Exact Engine Invariants:** Tests verify that turns strictly enforce maximal dice usage, promotion suffixes, and king captures without inventing moves or skipping actions.
- **Snapshot Integrity:** Asserts that invalid or corrupted game snapshots are rejected before reaching disk, preventing corrupted state from overwriting good games.
- **Exactly-Once Ledger Accounting:** Simulates process crashes between game finish and ledger update, confirming that completed matches are counted exactly once across reloads.
- **Rules Guide Accuracy:** Each of the 9 rules guide topics is verified against the engine. Three injected factual errors were tested and caught by the suite.
- **Visual Bounds & Safe Area:** `native/test/splash.test.ts` scans PNG pixel buffers to confirm that the app icon remains inside the 3:2 launcher crop safe zone.

## Continuous Integration & Security Analysis

Every commit and pull request runs through automated pipelines on GitHub Actions:

```text
GitHub Push / Pull Request
├── CI Workflow (.github/workflows/ci.yaml)
│   ├── Format check (Prettier)
│   ├── English-only validation (test/english.test.ts)
│   ├── TypeScript compilation (Root & Native)
│   ├── 193 automated tests
│   └── Package build verification
├── CodeQL Workflow (.github/workflows/codeql.yaml)
│   └── Automated semantic code analysis for security vulnerabilities
└── Documentation Deployment (.github/workflows/deploy-site.yaml)
    └── Astro Starlight site build & friction log verification
```

### SonarCloud Quality Gate

The repository is integrated with [SonarCloud](https://sonarcloud.io/summary/new_code?id=fortemate_dicechess-tv), enforcing a strict quality gate on all new code:

- **0** Bugs
- **0** Vulnerabilities
- **0** Security Hotspots
- High test coverage maintained across pure business logic and UI state reducers.

### Code Review with CodeRabbit

Pull requests receive automated reviews from CodeRabbit, auditing changes for architectural consistency, performance regressions, edge cases, and compliance with project conventions before human maintainer review.

## Pre-Commit Hooks & Development Guardrails

To catch issues before they enter git history:

1. **English-Only Enforcement (`test/english.test.ts`):** Scans all tracked and untracked text files in the repository using the Unicode `\p{Script=Cyrillic}` regex. Zero Cyrillic characters are permitted, ensuring no private notes or internal team language leak into public code.
2. **Secret Scanning:** Pre-commit hooks check for API keys, tokens, credentials, or private model parameters.
3. **Format Checking:** Code formatting is validated by Prettier (`npm run format:check`).

## Empirically Measured UX: The Press Evaluator

Living-room game design decisions are made with empirical data rather than guesswork.

Moving a cursor across an 8x8 chessboard one square at a time is tedious on a TV remote. The project authored an automated press evaluator (`scripts/cursor-presses.ts`) that replayed **200 seeded random games** through the core engine to measure different navigation models:

| Navigation Model                      | Presses per Turn | Reachability Proof                  |
| ------------------------------------- | ---------------- | ----------------------------------- |
| **Square-by-Square Movement**         | **22.6 presses** | Standard 2D grid traversal          |
| **Directional Jumps Between Options** | **8.7 presses**  | **61% reduction** in remote presses |

To ensure that no piece or destination could ever become unreachable through directional jumps, the jump rule was evaluated across **20,000 randomized square configurations**. The algorithm achieved 100% reachability, whereas two simpler alternative heuristics left squares trapped.

## Virtual Device & Emulator Automation

End-to-end device testing is automated through [`vega-vvd-driver`](https://github.com/fortemate/vega-vvd-driver) (`vvd`):

- **Scripted Headless Execution:** The driver launches the Vega Virtual Device in `--no-gui` mode, activates gRPC, installs package builds, and drives full game sessions via evdev key codes.
- **Screenshot Diffing & Safe Area Checks:** Captures 1080p framebuffers and validates that no text or UI elements encroach on the outer 5% television overscan boundary (`vvd safe-area`).
- **Physical Hardware Track:** Live App Testing (LAT) on Amazon Developer Console is configured for 32-bit `armv7` Fire TV Sticks (AFTCA002 and AFTCL001), preparing for final submission verification ([#10](https://github.com/fortemate/dicechess-tv/issues/10)).

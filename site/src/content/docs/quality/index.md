---
title: How we test and review
description: Tests in Node, continuous integration, CodeQL, SonarCloud, CodeRabbit reviews on request, pre-commit hooks, and scripted checks on the Vega Virtual Device.
sidebar:
  order: 1
---

Most checks run in Node: unit tests of the shared core and of the app's screens, type checks and lint, on every pull request. What the television shows is checked on the Vega Virtual Device, by hand or from scripts. The game has not yet run on a Fire TV Stick.

## The Test Suite

Three packages have tests, all on Node's own test runner (`node --test`) with the Node version in `mise.toml`. Counts and times are as of 4 October 2026, on a Mac:

| Suite                          | Scope                                                                                                                                                                                                                                                                                      | Runner & Environment                                                                                                                                                   | Count                                                                                                   | Duration       |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | -------------- |
| **Core Suite** (`test/`)       | The turn controller and its legal actions, dice, saved-game snapshots, the completed-game ledger, the rules guide against the engine, the opponents' engine algorithms, the tutorial's lessons, the danger search, cursor jumps and press counts, voice lines, and the English-only check. | `node --test --experimental-strip-types`, with `node:assert/strict`.                                                                                                   | **245 tests**                                                                                           | **about 1 s**  |
| **App Suite** (`native/test/`) | Board and piece rendering, remote input and focus, menus, the tutorial, saving and the ledger across relaunches, sound, music and voices (ducking included), the reduced-motion path against a stubbed platform setting, and the generated assets, the launcher icon among them.           | `node --test` with esbuild module hooks (`native/test/hooks.mjs`); `react-test-renderer` over hand-written stubs of `react-native` and the `@amazon-devices` packages. | **300 tests**, 1 skipped (it needs the opponents' portraits, which the public repository does not hold) | **about 9 s**  |
| **Web Bench** (`web/test/`)    | The browser test bench's configuration and board marks.                                                                                                                                                                                                                                    | `node --test --experimental-strip-types`.                                                                                                                              | **8 tests**                                                                                             | **under 1 s**  |
| **Total**                      | Logic and component trees in Node, against stubs of the Vega packages; none of it runs on a Vega device.                                                                                                                                                                                   | Local dev & GitHub Actions CI                                                                                                                                          | **553 tests**                                                                                           | **about 10 s** |

### What the Tests Verify

- **Turns follow the engine:** tests check that the turn controller accepts only actions the rules engine lists. A turn must use as many dice as the position allows, promotion offers only the engine's choices, a king capture ends the game at once, and a save or bot reply that skips or invents an action is refused.
- **Saved games:** a snapshot is validated before it is written, and tests check that a damaged one is refused and never replaces a good save (against an in-memory stand-in for MMKV).
- **Completed games counted once:** tests recreate what a crash between a game's end and the ledger write would leave, then relaunch, and check that each finished game is counted exactly once.
- **Rules guide:** 18 of the in-game rules guide's 33 sentences, in 8 of its 9 topics, are each tied to a test that checks the engine does what the sentence says (counted on 4 October 2026). The en passant topic has none. When the guide was written (23 September 2026), three false sentences were put in by hand, and each failed its test.
- **Launcher icon:** `native/test/splash.test.ts` reads the icon's pixels and fails if any artwork lies outside the band the launcher keeps when it crops the icon into a 3:2 tile. The band was measured on the Vega Virtual Device ([FL-16](/friction-log/#fl-16)).

## Continuous Integration & Security Analysis

GitHub Actions runs these workflows. The checks in `ci.yaml` run on every pull request and every push to main:

```text
GitHub Actions
├── Checks (.github/workflows/ci.yaml): pull requests and pushes to main
│   ├── core: tsc (twice), ESLint, Prettier check, core tests (the English-only check among them)
│   ├── native-board: tsc, ESLint with Amazon's Vega rules, app tests, JavaScript bundle for the kepler platform
│   ├── web-bench: bench tests, then tsc and the Vite build
│   └── sonar: coverage of the core and app suites, then the SonarCloud scan (informational)
├── CodeQL (GitHub default setup, no workflow file): JavaScript/TypeScript and GitHub Actions, on pull requests, pushes to main and weekly
├── CI: CLA (.github/workflows/cla.yaml): pull requests; checks that an outside contributor has signed the licence agreement
├── PR Labeler (.github/workflows/labeler.yaml): pull requests
└── CD: Deploy Site (.github/workflows/deploy-site.yaml): when the site, the bench or the code they draw changes
    └── Astro build, friction-log anchor check, bench build; deployed to Cloudflare from main
```

CI does not build the installable `.vpkg`: that needs the Vega SDK, which GitHub-hosted runners do not have, so it is built locally before each release.

### SonarCloud Quality Gate

The `sonar` CI job sends the test coverage of the core and the app to [SonarCloud](https://sonarcloud.io/summary/new_code?id=fortemate_dicechess-tv). It is informational: a failed scan or quality gate does not fail the run. The project uses SonarCloud's default quality gate, Sonar way, and passed it on 4 October 2026. That day SonarCloud reported:

- **0** bugs
- **0** vulnerabilities
- **0** security hotspots
- **98.5%** coverage. It comes from the Node tests, which run the app's code against stubs of `react-native` and the Vega packages, so it shows which lines the tests reach, not that the code behaves the same on a device.

### Code Review with CodeRabbit

CodeRabbit reviews only when asked to, with an `@coderabbitai review` comment on a pull request that changes code; automatic reviews are off (`.coderabbit.yaml`). Its instructions for the app's code list Vega behaviour measured on the Virtual Device and ask it to flag code that contradicts it, and comments that claim behaviour without evidence. Its reviews also run actionlint, zizmor, gitleaks, TruffleHog and ShellCheck.

## Pre-Commit Hooks & Development Guardrails

To catch issues before they enter git history, lefthook runs these jobs on each commit (`lefthook.yml`; `mise run setup` installs them):

1. **English only (`test/english.test.ts`):** reads every tracked file and every new file Git does not ignore, skipping binary files, and fails on any match of the Unicode `\p{Script=Cyrillic}` regex. No Cyrillic character is allowed. It catches text pasted from the project's private notes, which are not in English; it cannot detect private content written in English. CI runs the same test with the core suite.
2. **Secret scanning:** betterleaks scans the staged diff with its default rules for secrets such as API keys, tokens and private keys; nothing leaves the machine. On GitHub, secret scanning and push protection are also on for the repository.
3. **Formatting and workflows:** Prettier formats the staged files and adds the result to the commit, and actionlint checks staged workflow files. Before a push, `npm run format:check` checks the whole repository, as CI does.

## Counting Presses: The Press Evaluator

The way the cursor moves was chosen by counting presses.

Moving a cursor across the board one square at a time takes many presses on a TV remote. A script, `scripts/cursor-presses.ts` (`npm run presses`), plays **200 seeded random games** through the app's shared core, with random legal actions for both sides, and counts the arrow and OK presses each way of moving the cursor would need. Random moves are not a person's moves, but every way is scored on the same ones. [#68](https://github.com/fortemate/dicechess-tv/issues/68) recorded the first run; the figures below are from the run of 4 October 2026, seed 68, 8,346 turns:

| Navigation Model                          | Presses per Hotseat Turn | Change                |
| ----------------------------------------- | ------------------------ | --------------------- |
| **Square by square**                      | **23.0 presses**         | Baseline              |
| **Jumps between pieces and destinations** | **9.2 presses**          | **60% fewer presses** |

Random movers take no more often than they make any other move, so this count cannot credit where the cursor lands once a piece is picked up. Landing on captures costs them 0.29 presses a turn: 9.21 against 8.92 with the cursor always landing on the central destination. The landing follows people, who take far more often than not.

Jumps must not leave a piece or destination out of reach. Over **20,000 random sets of squares**, of 3 to 8 squares each, also recorded in #68, the jump rule the board uses (the cone rule) left no square out of reach. The two other rules it was compared with, axis and nearest, each left a square out of reach in some sets. That is a sample, not a proof; a unit test (`test/cursor.test.ts`) pins one set where the axis rule fails and the cone rule does not. The sample does not cover larger sets or every starting square: in the 200 simulated games, a queen with fifteen destinations had one that the arrows reach only from the central destination. So the cursor lands anywhere else only when every destination stays in reach from there, and `test/boardInput.test.ts` checks that position.

## Virtual Device & Emulator Automation

What the television shows is checked on the Vega Virtual Device, by hand or from scripts, with [`vega-vvd-driver`](https://github.com/fortemate/vega-vvd-driver) (`vvd`), Fortemate's open-source driver for it. CI has no Virtual Device, so none of this runs in CI:

- **Scripted sessions:** Amazon's `vega` CLI starts the Virtual Device (also without its window, with `--no-gui`), installs the package and launches the app. `vvd enable-grpc` turns on the emulator's gRPC endpoint, and `vvd press` sends remote keys as Linux evdev codes, the route the Virtual Device's own on-screen remote uses. On 28 September 2026 a script drove beta 5 this way through Settings, the rules guide, About, a resumed game and the tutorial's first move.
- **Screenshots and the safe area:** `vvd screenshot` saves the 1920x1080 screen as a PNG, and `vvd wait-change` exits once the screen changes, so a script can tell that a press did something. `vvd safe-area` counts the pixels in the outer 5% of each edge that differ from a solid background colour; in the same session on 28 September 2026, it found the margins clear on the rules guide, About and the tutorial's first lesson. A unit test, `native/test/layout.test.ts`, checks the 48 dp and 27 dp insets the layout keeps.
- **Fire TV Stick:** through Live App Testing, owners of a Fire TV Stick 4K Select or a Fire TV Stick HD (2nd generation) can install the beta from the Amazon Appstore by invitation (see [Play the beta](/play/beta/)). The game has been tested on the Vega Virtual Device so far, and not yet on a Fire TV Stick.

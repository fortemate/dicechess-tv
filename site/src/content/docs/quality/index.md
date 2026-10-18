---
title: How we test and review
description: Tests in Node, continuous integration, CodeQL, SonarCloud, CodeRabbit reviews on request, pre-commit hooks, and scripted checks on the Vega Virtual Device.
sidebar:
  order: 1
---

Most checks run in Node: unit tests of the shared core and of the app's screens, type checks and lint, on every pull request. What the television shows is checked on the Vega Virtual Device, by hand or from scripts, and since October 6, 2026, on a Fire TV Stick 4K Select as well (see the end of this page).

## The Test Suite

Three packages have tests, all on Node's own test runner (`node --test`) with the Node version in `mise.toml`. Counts and times are from the October 18, 2026, local check on a Mac:

<div class="suite-cards">
  <article class="suite-card">
    <div class="suite-card-header">
      <div class="suite-card-title">
        Core Suite <code>test/</code>
      </div>
      <div class="suite-card-metrics">
        <span class="suite-badge count">334 tests</span>
        <span class="suite-badge duration">about 14 s</span>
      </div>
    </div>
    <p class="suite-card-scope">
      The turn controller and its legal actions, dice, saved-game snapshots, the completed-game ledger, the rules guide against the engine, the opponents’ engine algorithms, the tutorial’s lessons, the danger search, cursor jumps and press counts, voice lines, and the English-only check.
    </p>
    <div class="suite-card-meta">
      <span class="suite-meta-label">Runner &amp; environment:</span>
      <code>node --test --experimental-strip-types</code>, with <code>node:assert/strict</code>
    </div>
  </article>

  <article class="suite-card">
    <div class="suite-card-header">
      <div class="suite-card-title">
        App Suite <code>native/test/</code>
      </div>
      <div class="suite-card-metrics">
        <span class="suite-badge count">624 tests</span>
        <span class="suite-badge duration">about 25 s</span>
      </div>
    </div>
    <p class="suite-card-scope">
      Board and piece rendering, remote input and focus, menus, the tutorial, saving and the ledger across relaunches, sound, music and voices (ducking included), the reduced-motion path against a stubbed platform setting, and the generated assets, the launcher icon among them.
    </p>
    <div class="suite-card-meta">
      <span class="suite-meta-label">Runner &amp; environment:</span>
      <code>node --test</code> with esbuild module hooks (<code>native/test/hooks.mjs</code>); <code>react-test-renderer</code> over hand-written stubs of <code>react-native</code> and the <code>@amazon-devices</code> packages.
    </div>
    <div class="suite-card-note">
      The tracked portrait pack is checked in CI: its version, every pinned image and the original notice. These checks are required.
    </div>
  </article>

  <article class="suite-card">
    <div class="suite-card-header">
      <div class="suite-card-title">
        Web Bench <code>web/test/</code>
      </div>
      <div class="suite-card-metrics">
        <span class="suite-badge count">11 tests</span>
        <span class="suite-badge duration">under 1 s</span>
      </div>
    </div>
    <p class="suite-card-scope">
      The browser test bench’s configuration and board marks.
    </p>
    <div class="suite-card-meta">
      <span class="suite-meta-label">Runner &amp; environment:</span>
      <code>node --test --experimental-strip-types</code>
    </div>
  </article>

  <article class="suite-card total">
    <div class="suite-card-header">
      <div class="suite-card-title">
        Total
      </div>
      <div class="suite-card-metrics">
        <span class="suite-badge count highlight">969 tests</span>
        <span class="suite-badge duration highlight">about 40 s</span>
      </div>
    </div>
    <p class="suite-card-scope">
      Logic and component trees in Node, against stubs of the Vega packages; none of it runs on a Vega device.
    </p>
    <div class="suite-card-meta">
      <span class="suite-meta-label">Environment:</span>
      Local dev &amp; GitHub Actions CI
    </div>
  </article>
</div>

### What the Tests Verify

- **Turns follow the engine:** tests check that the turn controller accepts only actions the rules engine lists. A turn must use as many dice as the position allows, promotion offers only the engine's choices, a king capture ends the game at once, and a save or bot reply that skips or invents an action is refused.
- **Saved games:** a snapshot is validated before it is written, and tests check that a damaged one is refused and never replaces a good save (against an in-memory stand-in for MMKV).
- **Completed games counted once:** tests recreate what a crash between a game's end and the ledger write would leave, then relaunch, and check that each finished game is counted exactly once.
- **Rules guide:** 18 of the in-game rules guide's 33 sentences, in 8 of its 9 topics, are each tied to a test that checks the engine does what the sentence says (counted on October 4, 2026). The en passant topic has none. When the guide was written (September 23, 2026), three false sentences were put in by hand, and each failed its test.
- **Launcher icon:** `native/test/splash.test.ts` reads the icon's pixels and fails if any artwork lies outside the band the launcher keeps when it crops the icon into a 3:2 tile. The band was measured on the Vega Virtual Device ([FL-16](/friction-log/#fl-16)).

### Audio regression checks, October 14, 2026

The audio work in [PR #388](https://github.com/fortemate/dicechess-tv/pull/388) passed `mise run check` with 325 core, 586 native and 8 browser tests: 919 in total, including 33 added native regressions. They cover readiness and delayed playback, completion and cleanup, stale events, bounded failure and retry, silence during crossfade errors, and verified MP3 tag removal. These counts describe that PR's local checkout; the breakdown above retains the earlier public-checkout snapshot.

Release packages were built for armv7, aarch64 and x86_64. Separate VVD and physical Stick runs covered ten minutes of playback, all six tutorial lessons and all 45 tutorial clips, settings and Home/relaunch, plus eight injected crossfade failure/silence cases per device. Native events and release completions support the hardware result; recorded audio is from VVD. Clean packages were installed afterward, deployed JS/Hermes hashes matched their archives, and saved data and CRC matched their pre-test backups. The [validation record](https://github.com/fortemate/dicechess-tv/blob/c6109575aae7f0f125e8ff5b53566b089ed9de8f/docs/audio-regression-validation-387.md) separates the device, automated and package evidence, including cold Home recovery and the remaining warm-focus and physical-listening limits.

## Continuous Integration & Security Analysis

GitHub Actions runs these workflows. The checks in `ci.yaml` run on every pull request and every push to main:

```text
GitHub Actions
├── Checks (.github/workflows/ci.yaml): pull requests and pushes to main
│   ├── core: whitespace check of the change, tsc (twice), ESLint, Prettier check, core tests (the English-only check among them)
│   ├── native-board: tsc, ESLint with Amazon's Vega rules, app tests, JavaScript bundle for the kepler platform
│   ├── web-bench: bench tests, then tsc and the Vite build
│   └── sonar: coverage of the core and app suites, then the SonarCloud scan (informational)
├── CodeQL (GitHub default setup, no workflow file): JavaScript/TypeScript and GitHub Actions, on pull requests, pushes to main and weekly
├── CI: CLA (.github/workflows/cla.yaml): pull requests; checks that an outside contributor has signed the license agreement
├── PR Labeler (.github/workflows/labeler.yaml): pull requests
└── CD: Deploy Site (.github/workflows/deploy-site.yaml): when the site, the bench or the code they draw changes
    └── Astro build, friction-log anchor check, bench build; deployed to Cloudflare from main
```

CI does not build the installable `.vpkg`: that needs the Vega SDK, which GitHub-hosted runners do not have, so it is built locally before each release.

### SonarCloud Quality Gate

The `sonar` CI job sends the test coverage of the core and the app to [SonarCloud](https://sonarcloud.io/summary/new_code?id=fortemate_dicechess-tv). It is informational: a failed scan or quality gate does not fail the run. The project uses SonarCloud's default quality gate, Sonar way, and passed it on October 4, 2026. That day SonarCloud reported:

- **0** bugs
- **0** vulnerabilities
- **0** security hotspots
- **98.5%** coverage. It comes from the Node tests, which run the app's code against stubs of `react-native` and the Vega packages, so it shows which lines the tests reach, not that the code behaves the same on a device.

### Code Review with CodeRabbit

CodeRabbit reviews only when asked to, with an `@coderabbitai review` comment on a pull request that changes code; automatic reviews are off (`.coderabbit.yaml`). Its instructions for the app's code list Vega behavior measured on the Virtual Device and ask it to flag code that contradicts it, and comments that claim behavior without evidence. Its reviews also run actionlint, zizmor, gitleaks, TruffleHog and ShellCheck.

## Pre-Commit Hooks & Development Guardrails

To catch issues before they enter git history, lefthook runs these jobs on each commit (`lefthook.yml`; `mise run setup` installs them):

1. **English only (`test/english.test.ts`):** reads every tracked file and every new file Git does not ignore, skipping binary files, and fails on any match of the Unicode `\p{Script=Cyrillic}` regex. No Cyrillic character is allowed. It catches text pasted from the project's private notes, which are not in English; it cannot detect private content written in English. CI runs the same test with the core suite.
2. **Secret scanning:** betterleaks scans the staged diff with its default rules for secrets such as API keys, tokens and private keys; nothing leaves the machine. On GitHub, secret scanning and push protection are also on for the repository.
3. **Formatting and workflows:** Prettier formats the staged files and adds the result to the commit, and actionlint checks staged workflow files. Before a push, `npm run format:check` checks the whole repository, as CI does.

## Counting Presses: The Press Evaluator

The way the cursor moves was chosen by counting presses.

Moving a cursor across the board one square at a time takes many presses on a TV remote. A script, `scripts/cursor-presses.ts` (`npm run presses`), plays **200 seeded random games** through the app's shared core, with random legal actions for both sides, and counts the arrow and OK presses each way of moving the cursor would need. Random moves are not a person's moves, but every way is scored on the same ones. [#68](https://github.com/fortemate/dicechess-tv/issues/68) recorded the first run; the figures below are from the run of October 4, 2026, seed 68, 8,346 turns:

| Navigation Model                          | Presses per Hot Seat Turn | Change                |
| ----------------------------------------- | ------------------------- | --------------------- |
| **Square by square**                      | **23.0 presses**          | Baseline              |
| **Jumps between pieces and destinations** | **9.2 presses**           | **60% fewer presses** |

Random movers take no more often than they make any other move, so this count cannot credit where the cursor lands once a piece is picked up. Landing on captures costs them 0.29 presses a turn: 9.21 against 8.92 with the cursor always landing on the central destination. The landing follows people, who take far more often than not.

Jumps must not leave a piece or destination out of reach. Over **20,000 random sets of squares**, of 3 to 8 squares each, also recorded in #68, the jump rule the board uses (the cone rule) left no square out of reach. The two other rules it was compared with, axis and nearest, each left a square out of reach in some sets. That is a sample, not a proof; a unit test (`test/cursor.test.ts`) pins one set where the axis rule fails and the cone rule does not. The sample does not cover larger sets or every starting square: in the 200 simulated games, a queen with fifteen destinations had one that the arrows reach only from the central destination. So the cursor lands anywhere else only when every destination stays in reach from there, and `test/boardInput.test.ts` checks that position.

## Virtual Device & Emulator Automation

What the television shows is checked on the Vega Virtual Device, by hand or from scripts, with [`vega-vvd-driver`](https://github.com/fortemate/vega-vvd-driver) (`vvd`), Fortemate's open-source driver for it. CI has no Virtual Device, so these device checks do not run there.

**1.0.1, build 30 (October 14, 2026):** the candidate was checked separately on the Virtual Device and a physical Fire TV Stick 4K Select, including upgrade preservation, saved-turn recovery, settings, navigation, ten-minute Rampage and friend sessions on each device, and shorter Rolly/Grabby runs. Its 919 automated tests also passed. The final-main packages have the same application payload as the tested candidate; the published GitHub downloads were verified against their SHA-256 manifest. The owner additionally reported checking the Stick and finding everything working well. The [release validation record](https://github.com/fortemate/dicechess-tv/blob/main/docs/release-validation-1.0.1-build30.md) preserves the exact scope and limits. The earlier checks below remain evidence for their own dates and builds.

- **Scripted sessions:** Amazon's `vega` CLI starts the Virtual Device (also without its window, with `--no-gui`), installs the package and launches the app. `vvd enable-grpc` turns on the emulator's gRPC endpoint, and `vvd press` sends remote keys as Linux evdev codes, the route the Virtual Device's own on-screen remote uses. On September 28, 2026, a script drove beta 5 this way through Settings, the rules guide, About, a resumed game and the tutorial's first move.
- **Screenshots and the safe area:** `vvd screenshot` saves the 1920x1080 screen as a PNG, and `vvd wait-change` exits once the screen changes, so a script can tell that a press did something. `vvd safe-area` counts the pixels in the outer 5% of each edge that differ from a solid background color; in the same session on September 28, 2026, it found the margins clear on the rules guide, About and the tutorial's first lesson. A unit test, `native/test/layout.test.ts`, checks the 48 dp and 27 dp insets the layout keeps.
- **Fire TV Stick:** the owner's Fire TV Stick 4K Select has run the game since October 6, 2026. Checks there read the device log, the OS's traces or reports from the app itself, and the owner watches the television. They include the launch and the response to a cursor key ([Performance](/technology/performance/)), the dice's stagger, horizontal cycling on the board ([Board selection algorithm](/design/board-selection/)), the return from Home ([Building on Vega](/technology/vega/#leaving-the-foreground)) and the automatic OK on the only choice ([#342](https://github.com/fortemate/dicechess-tv/pull/342)). Version 1.0.0, build 26 of `dac3302`, was released on GitHub and submitted to the Amazon Appstore on October 10, 2026. Its release notes record what was checked on the Stick, on the Appstore build of that commit: Settings with the music row and Play as, muting and unmuting the music, Main menu and Resume game, the opponent cards, and the confirmation before a game in play is replaced. Build 28 of `d4ffdaa` replaced it on October 11, 2026; its Appstore build was installed on the Stick over an earlier build, kept the saved game, and opened on the home menu with no errors from the app in the device log ([release notes](https://github.com/fortemate/dicechess-tv/releases/tag/v1.0.0%2B28)).

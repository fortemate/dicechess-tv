# Dice Chess TV

[![Checks](https://github.com/fortemate/dicechess-tv/actions/workflows/ci.yaml/badge.svg)](https://github.com/fortemate/dicechess-tv/actions/workflows/ci.yaml)
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=fortemate_dicechess-tv&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=fortemate_dicechess-tv)
[![Coverage](https://sonarcloud.io/api/project_badges/measure?project=fortemate_dicechess-tv&metric=coverage)](https://sonarcloud.io/summary/new_code?id=fortemate_dicechess-tv)
[![License: AGPL-3.0-only](https://img.shields.io/badge/License-AGPL--3.0--only-blue.svg)](LICENSE)

Dice Chess for Amazon Fire TV: two players sharing one screen and remote, or a game against a choice of on-device bots.

**Project site:** <https://fortemate.github.io/dicechess-tv/>, built from [`site/`](site/README.md).

**Status: a React Native for Vega application that builds and runs from this repository.** `npm run build --prefix native` produces an installable package; it launches on the Vega Virtual Device in 227 ms and plays. Hotseat and a local Random opponent, three-die turns, promotion, king capture, resignation, draw agreement, save and resume mid-turn, a completed-game ledger, an interactive tutorial and a rules guide are all implemented on the native board, driven entirely by D-pad, OK and Back.

Also done: sound for every step of the game — chosen by ear, heard on the virtual device, with a switch in both menus — an icon and splash screen, and an About screen carrying the credits the asset licences require. Not done: onboarding and piece-movement animation. Everything above is evidence from the **virtual** device; nothing has yet run on physical Fire TV hardware, and the emulator does not measure Stick performance.

## Try it

It needs the Vega SDK 0.24 and either a Vega Virtual Device or a Fire TV Stick in developer mode; [native/README.md](native/README.md#building-and-running) explains the setup.

```bash
npm ci && npm ci --prefix native
npm run build --prefix native
vega device install-app -d VirtualDevice -p native/build/aarch64-release/dicechess-tv-native_aarch64.vpkg
vega device launch-app -d VirtualDevice -a com.fortemate.dicechesstv.main
```

The whole game is played with three controls:

| Remote | Virtual device keyboard | What it does                                                                                            |
| ------ | ----------------------- | ------------------------------------------------------------------------------------------------------- |
| D-pad  | Arrow keys              | Jumps between the pieces that can move, or the destinations of the one in hand; moves through the menus |
| OK     | Enter                   | Rolls the dice, picks up a piece, puts it on its destination, chooses a menu item                       |
| Back   | Esc                     | Puts a picked-up piece back, opens the game menu, closes a screen; on the home screen, leaves the app   |

The application has no network code, no accounts and no analytics. Games, results and settings stay on the device.

## Product scope

- Hotseat: two people take turns using one remote after each complete Dice Chess turn.
- Several entirely local bots, starting with Random and Aggressive. The interface must never stall: Random turned out to need no thread of its own, and a stronger bot's strength comes from a bounded work budget rather than from wall-clock time.
- No stake doubling, coins, wallets or betting in the initial game.
- Local win/draw/loss (W/D/L) statistics, separated by opponent and hotseat mode.
- D-pad, OK and Back navigation through the board, dice, promotion, menus and results.
- Save and resume the full game state, including the existing dice roll and remaining actions.
- A self-contained installed package as the offline target.

Online matchmaking, accounts, rankings, cloud bots and subscriptions are outside the initial MVP. Hunter is a conditional later bot; a one-time unlock is a monetization idea, not an implemented or committed purchase feature.

See [offline game scope](docs/offline-game-scope.md) for the accepted requirements, proposed statistics behavior and delivery order. This scope update supersedes the earlier single-bot MVP description in the hackathon research notes.

## Architecture

```text
native/ — the React Native for Vega application
├── Board and screens, drawn with @amazon-devices/react-native-svg
├── Remote input: useTVEventHandler for the D-pad and OK,
│                 useKeplerBackHandler for Back
└── Snapshot store on MMKV
        │
        ▼
src/core/ — one shared, pure TypeScript core, no DOM and no React
├── Turn controller → Dice Chess engine
├── Local bot, which needs no thread of its own
└── Versioned game snapshot, ledger, tutorial and rules data
```

The core is pure by enforcement, not by convention: `tsconfig.core.json` compiles it with `lib: ES2022` and `types: []`, so a DOM or Node global there fails `npm run check`. That purity is what let one verified controller serve the WebView probe and the native board at once, and what let the probe be deleted without touching the rules.

The canonical engine determines legal actions and board transitions. A narrow adapter retains dice across the pinned engine API's board-only `applyMove` result; the controller applies the existing game-service terminal policy. See the compatibility note in the full-game guide. The board only renders state and emits intent.

[native/README.md](native/README.md) is the running record of what this platform actually does — input channels, persistence, randomness, sound — and has the build and install commands.

This repository owns TV-specific packaging, input and application integration. Reuse appropriate public components from [dicechess-play](https://github.com/fortemate/dicechess-play) and [dicechess-engine](https://github.com/fortemate/dicechess-engine) after checking their licenses. Shared fixes should return to their source repositories.

Fire OS is a possible later target with a separate build. Samsung/Tizen, Raspberry Pi and hardware purchases are deferred.

## Completed feasibility milestone

The Svelte + Chessground WebView app that came first has been removed. It was a probe, and its WebView crashes on SDK 0.24 — the SDK the native path targets — so it could never have shipped. The [feasibility probe](docs/prototype.md), [SDK experiment](docs/vega-sdk-experiment.md), [durable-save/offline checks](docs/durable-save-and-offline.md) and [full-game behavior](docs/full-game.md) record what it established and remain the evidence for that period.

These steps were carried out on the WebView path and are kept as the record of how the target was proved reachable. The application that grew from them is the native one described above.

1. Install and record Vega CLI/SDK and Node versions on the development Mac.
2. Run the official Hello World in Vega Virtual Device.
3. Create the official `vegaWebview` template and load bundled local assets.
4. Display a board and demonstrate D-pad, OK and Back without a mouse.
5. Execute one engine transition and one Worker bot request.
6. Save, close and restore the exact position, roll and phase.
7. Repeat without a development server or network, and record actual limitations.

That loop closed on SDK 0.23. The native runtime gate then passed on SDK 0.24 — the WebView crash does not reproduce natively — and the board, remote input, saves, dice, menus, the Random opponent, the result ledger, the tutorial and the rules guide were built on that path instead. What remains is onboarding, piece-movement animation, the submission build and physical-device testing. See the [delivery roadmap](docs/roadmap.md), the [runtime gate](docs/vega-native-runtime-gate.md) and [GitHub milestones](https://github.com/fortemate/dicechess-tv/milestones).

## Hackathon

Prepared for [Build, Ship, Shape: Amazon Developer Hackathon 2026](https://amazonappdev2026.devpost.com/), Fire TV track.

- Submission deadline: **23 October 2026, 12:00 Pacific / 22:00 Europe/Riga**.
- Internal submission target: **21 October 2026**.
- Owner confirmed registration on 21 September 2026. Final submission and Appstore publication remain separate, unconfirmed actions.
- Demonstrate the actual Vega/Fire TV environment and clearly distinguish reused components from work completed during the contest window.
- Keep a reproducible SDK friction log and record tool versions from the first experiment.

Full decisions and the detailed schedule are maintained in the private Fortemate knowledge base, starting from the page **Build, Ship, Shape — Amazon Developer Hackathon 2026**.

## Licensing

Fortemate's code in this repository is licensed under the [GNU Affero General Public License v3.0 only](LICENSE) (AGPL-3.0-only), the licence of the Dice Chess engine it runs on. Contributions are accepted under the [Contributor License Agreement](CLA.md); see [CONTRIBUTING.md](CONTRIBUTING.md).

The Fortemate name and logo, including the brand images in `native/brand/`, are not licensed under the AGPL.

Third-party material keeps its own licence, listed in the [third-party notices](THIRD_PARTY_NOTICES.md): the RhosGFX pieces and Kenney's sounds are CC0, and JDSherbert's sounds are here with the author's written permission. Amazon's `@amazon-devices/*` packages install from the public npm registry under Amazon's Program Materials License Agreement, and the Vega SDK is installed by each developer; neither is part of this repository. Check the licence of any code or asset before importing it.

Chessground's GPL-3.0-or-later obligation is gone: it was reached only by the web probe, and the probe has been removed.

## Development guidance

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup, checks and device verification, and follow [AGENTS.md](AGENTS.md). Changes go through branches and pull requests; the owner reviews and merges. Keep secrets, private models, opening books and production configuration out of this repository.

## References

- [Vega developer documentation](https://developer.amazon.com/docs/vega/0.24/vega-get-started)
- [Vega WebView](https://developer.amazon.com/docs/vega/0.24/develop-your-app-with-webview) — the abandoned path, kept for the record
- [Vega Virtual Device and device execution](https://developer.amazon.com/docs/vega/0.24/run-apps)
- [Hackathon rules](https://amazonappdev2026.devpost.com/rules)

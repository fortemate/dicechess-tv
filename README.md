# Dice Chess TV

Dice Chess for Amazon Fire TV: two players sharing one screen and remote, or a game against a choice of on-device bots.

**Status: project bootstrap.** There is no runnable TV application yet. The first target is Vega Virtual Device on an Apple Silicon Mac; compatibility, offline operation and bot performance still need runtime verification.

## Product scope

- Hotseat: two people take turns using one remote after each complete Dice Chess turn.
- Several entirely local bots, starting with Random and Aggressive; computation stays off the UI thread.
- No stake doubling, coins, wallets or betting in the initial game.
- Local win/draw/loss (W/D/L) statistics, separated by opponent and hotseat mode.
- D-pad, OK and Back navigation through the board, dice, promotion, menus and results.
- Save and resume the full game state, including the existing dice roll and remaining actions.
- A self-contained installed package as the offline target.

Online matchmaking, accounts, rankings, cloud bots and subscriptions are outside the initial MVP. Hunter is a conditional later bot; a one-time unlock is a monetization idea, not an implemented or committed purchase feature.

See [offline game scope](docs/offline-game-scope.md) for the accepted requirements, proposed statistics behavior and delivery order. This scope update supersedes the earlier single-bot MVP description in the hackathon research notes.

## Proposed architecture

```text
React Native for Vega shell
└── Vega WebView
    └── TV interface: Svelte + Chessground
        ├── Game controller → Dice Chess engine
        ├── Web Worker → local bot
        └── Versioned local game snapshot
```

The shell handles platform integration. The web layer renders the game and handles remote navigation. The canonical engine determines legal actions, dice consumption, complete turns and terminal states; the board must not implement a second set of rules.

This repository owns TV-specific packaging, input and application integration. Reuse appropriate public components from [dicechess-play](https://github.com/fortemate/dicechess-play) and [dicechess-engine](https://github.com/fortemate/dicechess-engine) after checking their licenses. Shared fixes should return to their source repositories.

Fire OS is a possible later target with a separate build. Samsung/Tizen, Raspberry Pi and hardware purchases are deferred.

## First implementation milestone

1. Install and record Vega CLI/SDK and Node versions on the development Mac.
2. Run the official Hello World in Vega Virtual Device.
3. Create the official `vegaWebview` template and load bundled local assets.
4. Display a board and demonstrate D-pad, OK and Back without a mouse.
5. Execute one engine transition and one Worker bot request.
6. Save, close and restore the exact position, roll and phase.
7. Repeat without a development server or network, and record actual limitations.

Only then proceed to a complete hotseat game, the Random/Aggressive bot selection, local statistics and user testing. There are no installation, build or test commands for this repository yet; add reproducible commands with the first runnable implementation.

## Hackathon

Prepared for [Build, Ship, Shape: Amazon Developer Hackathon 2026](https://amazonappdev2026.devpost.com/), Fire TV track.

- Submission deadline: **23 October 2026, 12:00 Pacific / 22:00 Europe/Riga**.
- Internal submission target: **21 October 2026**.
- Registration, final submission and Appstore publication are separate actions; none is implied by this repository.
- Demonstrate the actual Vega/Fire TV environment and clearly distinguish reused components from work completed during the contest window.
- Keep a reproducible SDK friction log and record tool versions from the first experiment.

Full decisions and the detailed schedule are maintained in the private Fortemate knowledge base under **Build, Ship, Shape — Amazon Developer Hackathon 2026**, **Dice Chess для Fire TV — разработка на Mac**, and **Amazon Developer Hackathon — регистрация и подача Dice Chess**.

## Licensing

The repository license has not been selected. No third-party application code or artwork has been copied into this bootstrap.

Chessground is GPL-3.0-or-later. Reusing it requires a compatible distribution and source-availability plan; private repository visibility does not remove those obligations. Check the licenses of the engine, reused play-client code, piece artwork, fonts and samples before importing or distributing them. Commercial sale and closed-source distribution are different questions.

## Development guidance

Follow [AGENTS.md](AGENTS.md). Changes go through branches and pull requests; the owner reviews and merges. Keep secrets, private models, opening books and production configuration out of this repository.

## References

- [Vega developer documentation](https://developer.amazon.com/docs/vega/0.24/vega-get-started)
- [Vega WebView](https://developer.amazon.com/docs/vega/0.24/develop-your-app-with-webview)
- [Vega Virtual Device and device execution](https://developer.amazon.com/docs/vega/0.24/run-apps)
- [Chessground](https://github.com/lichess-org/chessground)
- [Hackathon rules](https://amazonappdev2026.devpost.com/rules)

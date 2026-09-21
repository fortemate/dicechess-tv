# Dice Chess TV

Dice Chess for Amazon Fire TV: two players sharing one screen and remote, or a game against a choice of on-device bots.

**Status: full offline gameplay prototype.** The web app now supports hotseat and a local Random opponent, three-die turns, promotion, king capture, resignation, draw agreement and save/resume during a turn. Browser checks cover keyboard-only play and result recovery. The external SDK 0.23 / RN 0.72 shell runs the bundled app on Vega Virtual Device on the development MacBook Air. See [full-game behavior and evidence](docs/full-game.md) for the exact verification boundary.

Aggressive, W/D/L statistics, physical Fire TV testing and production native packaging remain future work. SDK 0.24 WebView compatibility is still unresolved. The native shell remains outside this repository.

The earlier [feasibility probe](docs/prototype.md), [SDK experiment](docs/vega-sdk-experiment.md) and [durable-save/offline checks](docs/durable-save-and-offline.md) document the diagnostic that preceded this game.

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

The shell handles platform integration. The web layer renders the game and handles remote navigation. The canonical engine determines legal actions and board transitions. A narrow adapter retains dice across the pinned engine API’s board-only `applyMove` result; the controller applies the existing game-service terminal policy. See the compatibility note in the full-game guide. The board only renders state and emits intent.

This repository owns TV-specific packaging, input and application integration. Reuse appropriate public components from [dicechess-play](https://github.com/fortemate/dicechess-play) and [dicechess-engine](https://github.com/fortemate/dicechess-engine) after checking their licenses. Shared fixes should return to their source repositories.

Fire OS is a possible later target with a separate build. Samsung/Tizen, Raspberry Pi and hardware purchases are deferred.

## Completed feasibility milestone

1. Install and record Vega CLI/SDK and Node versions on the development Mac.
2. Run the official Hello World in Vega Virtual Device.
3. Create the official `vegaWebview` template and load bundled local assets.
4. Display a board and demonstrate D-pad, OK and Back without a mouse.
5. Execute one engine transition and one Worker bot request.
6. Save, close and restore the exact position, roll and phase.
7. Repeat without a development server or network, and record actual limitations.

The narrow feasibility loop is complete on SDK 0.23. The next delivery step is the local result ledger and W/D/L view, followed by polished TV interaction, rules and onboarding. Aggressive is a stretch goal. See the [delivery roadmap](docs/roadmap.md) and [GitHub milestones](https://github.com/fortemate/dicechess-tv/milestones). Full-game code and tests are now available; production packaging and physical-device testing remain separate work.

## Hackathon

Prepared for [Build, Ship, Shape: Amazon Developer Hackathon 2026](https://amazonappdev2026.devpost.com/), Fire TV track.

- Submission deadline: **23 October 2026, 12:00 Pacific / 22:00 Europe/Riga**.
- Internal submission target: **21 October 2026**.
- Owner confirmed registration on 21 September 2026. Final submission and Appstore publication remain separate, unconfirmed actions.
- Demonstrate the actual Vega/Fire TV environment and clearly distinguish reused components from work completed during the contest window.
- Keep a reproducible SDK friction log and record tool versions from the first experiment.

Full decisions and the detailed schedule are maintained in the private Fortemate knowledge base under **Build, Ship, Shape — Amazon Developer Hackathon 2026**, **Dice Chess для Fire TV — разработка на Mac**, and **Amazon Developer Hackathon — регистрация и подача Dice Chess**.

## Licensing

The repository license has not been selected. The private prototype imports pinned engine, Chessground and Svelte packages; see [third-party notices](THIRD_PARTY_NOTICES.md). No third-party piece artwork is bundled. Resolve the combined distribution license before shipping a binary.

Chessground is GPL-3.0-or-later. Reusing it requires a compatible distribution and source-availability plan; private repository visibility does not remove those obligations. Check the licenses of the engine, reused play-client code, piece artwork, fonts and samples before importing or distributing them. Commercial sale and closed-source distribution are different questions.

## Development guidance

Follow [AGENTS.md](AGENTS.md). Changes go through branches and pull requests; the owner reviews and merges. Keep secrets, private models, opening books and production configuration out of this repository.

## References

- [Vega developer documentation](https://developer.amazon.com/docs/vega/0.24/vega-get-started)
- [Vega WebView](https://developer.amazon.com/docs/vega/0.24/develop-your-app-with-webview)
- [Vega Virtual Device and device execution](https://developer.amazon.com/docs/vega/0.24/run-apps)
- [Chessground](https://github.com/lichess-org/chessground)
- [Hackathon rules](https://amazonappdev2026.devpost.com/rules)

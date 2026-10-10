# Dice Chess TV

[![Checks](https://github.com/fortemate/dicechess-tv/actions/workflows/ci.yaml/badge.svg)](https://github.com/fortemate/dicechess-tv/actions/workflows/ci.yaml)
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=fortemate_dicechess-tv&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=fortemate_dicechess-tv)
[![Coverage](https://sonarcloud.io/api/project_badges/measure?project=fortemate_dicechess-tv&metric=coverage)](https://sonarcloud.io/summary/new_code?id=fortemate_dicechess-tv)
[![License: AGPL-3.0-only](https://img.shields.io/badge/License-AGPL--3.0--only-blue.svg)](LICENSE)

Dice Chess for Amazon Fire TV: two players sharing one screen and remote, or a game against a choice of on-device bots.

**Project site:** <https://dicechess-tv.fortemate.com/>, built from [`site/`](site/README.md).

**Browser test bench:** [`web/`](web/README.md) draws the same screens in a browser, driven from the keyboard, with switchable board marks and a colour-vision simulation — for testers without an emulator. It is not device evidence.

**Demo video:** <https://youtu.be/LG_vw53uvQU>, 2:49, narrated by Thinkle the wizard and recorded on the Vega Virtual Device.

**Tutorial video:** <https://youtu.be/KK8BBICjaBQ>, 4:52, recorded on the Vega Virtual Device: Thinkle the wizard teaches the six lessons of the tutorial aloud. The home menu has called it Learn to play since #280; the video shows its older label, How to play.

**Status: Dice Chess 1.0.0 is released.** Build 26 was published on GitHub on 10 October 2026, tagged [`v1.0.0+26`](https://github.com/fortemate/dicechess-tv/releases/tag/v1.0.0%2B26), and its armv7 package was submitted to the Amazon Appstore the same day. It awaits Amazon's review and is not in the store yet.

**A React Native for Vega application that builds and runs from this repository.** `mise run build` produces an installable package that installs, launches and plays on the Vega Virtual Device and, since 6 October 2026, on a Fire TV Stick 4K Select (Vega OS 1.2). On that Stick, Amazon's KPI Visualizer measured a cool start of a Release build at a median of 412 ms to first frame and 2.65 s to fully drawn (6 October 2026, 9 launches, not in certification mode), against Amazon's cool-start targets of under 1.5 s and under 8 s; the [Performance](https://dicechess-tv.fortemate.com/technology/performance/) page has the warm starts too. On the Virtual Device, the same tool measured 309 ms and 748 ms on average (25 September 2026, 3 iterations, before the music, voices and portraits; [FL-20](https://dicechess-tv.fortemate.com/friction-log/#fl-20)). Play a friend and three local opponents, from easy to hard, three-die turns, promotion, king capture, resignation, draw agreement, save and resume mid-turn, a completed-game ledger, an interactive tutorial offered on the first launch, and a rules guide are all implemented on the native board, driven entirely by D-pad, OK and Back.

Also done: sound for every step of the game — chosen by ear, heard on the virtual device, and set on a settings screen in both menus — an icon and splash screen, and an About screen carrying the credits the asset licences require. Adaptive music follows the danger to the king, with four themes by pepka-prygni used with his permission. On the virtual device it was heard following a recorded game against Rampage from calm to tense to critical, and its own reports show it stopping for the launcher ([#76](https://github.com/fortemate/dicechess-tv/issues/76)). Each move slides to its new square, so an opponent's turn can be followed ([#131](https://github.com/fortemate/dicechess-tv/issues/131)), a roll tumbles in ([#99](https://github.com/fortemate/dicechess-tv/issues/99)), and the board can turn to the side to move in a game against a friend ([#120](https://github.com/fortemate/dicechess-tv/issues/120)). **Auto-select only choice**, off by default, presses OK when the board offers only one choice; it was checked on the virtual device and on the Stick ([#342](https://github.com/fortemate/dicechess-tv/pull/342)). Unless a sentence names the Stick, what this paragraph describes was seen on the **virtual** device, and the emulator does not measure Stick performance. On the Stick, a roll's second and third dice came in late until their stagger moved onto the native driver; the owner played that build there and reported that it works ([#306](https://github.com/fortemate/dicechess-tv/pull/306)). Memoizing the board cut the median time from a cursor key to the frame that shows it from 152 ms to 59 ms there ([#326](https://github.com/fortemate/dicechess-tv/pull/326)), and the app pauses at Home and takes `focus` as its return, which is how the Stick signalled it ([#296](https://github.com/fortemate/dicechess-tv/pull/296)). On 10 October 2026 the Appstore package of build 26 was checked on the Stick: the Settings rows, muting and unmuting the music on its row, Play as on Random, Main menu and Resume game, the hint on the opponent cards, and the confirmation before a game in play is replaced, with Cancel ([release notes](https://github.com/fortemate/dicechess-tv/releases/tag/v1.0.0%2B26)).

## Try it

It needs the Vega SDK 0.24, [mise](https://mise.jdx.dev/) and either a Vega Virtual Device or a Fire TV Stick in developer mode; [native/README.md](native/README.md#building-and-running) explains the setup. To play the 1.0.0 release without building it, follow [docs/playtest.md](docs/playtest.md).

```bash
npm ci && npm ci --prefix native
# Builds a package numbered like the newest release or beta tag, then installs
# the one built for the Virtual Device's processor and launches it
mise run device:run
```

A device refuses a package numbered lower than the one installed, with "Package version decrease". `mise run build` and `mise run device:run` take the build number from the newest tag, `v1.0.0+26` today, so a device with that build or an earlier one accepts their package. A plain `npm run build --prefix native` numbers its package 0, which a device with 1.0.0 or any beta from beta 4 on refuses ([CONTRIBUTING.md](CONTRIBUTING.md#check-it-on-a-device)).

The whole game is playable with three controls (D-pad, OK, and Back), while the remote Menu button provides a fourth control:

| Remote | Virtual device keyboard | What it does                                                                                                                                                                                                                                                                                               |
| ------ | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D-pad  | Arrow keys              | Jumps between the pieces that can move, or the destinations of the one in hand; moves through the menus                                                                                                                                                                                                    |
| OK     | Enter                   | Rolls the dice, picks up a piece, puts it on its destination, chooses a menu item                                                                                                                                                                                                                          |
| Back   | Esc                     | Puts a picked-up piece back, opens the game menu, closes a screen; on the home screen, leaves the app                                                                                                                                                                                                      |
| Menu   | F2 (not yet checked)    | Puts a picked-up piece back and opens the game menu; closes open menus; leaves secondary screens for home (covered by tests; opened and closed the game menu on a Fire TV Stick, as [the cycling validation](docs/board-navigation-validation-299.md) records; not yet checked on the Vega Virtual Device) |

The application has no network code, no accounts and no analytics. Games, results and settings stay on the device; the [privacy policy](https://dicechess-tv.fortemate.com/privacy/) lists what it keeps.

## Product scope

- Play a friend: two people take turns using one remote after each complete Dice Chess turn, with an optional living-room setting to turn the board to the active player's side, and a neutral host who cheers both players at the pauses and at the big moments as they happen (#202, #227): Prowla the cat (#258), Rolly, or Thinkle the wizard (#279). While the host speaks, she shows with her line above the bottom badge (#213: seen on the Vega Virtual Device and checked by tests, not yet checked on a Fire TV Stick), and Settings chooses the host, Prowla by default, or turns her off.
- Several entirely local bots: Rolly, Grabby and Rampage today, each one of the engine's algorithms. The interface must never stall: these three compute their reply on the JavaScript thread and have not needed a thread of their own on the Vega Virtual Device, and a stronger bot's strength must come from its algorithm or a bounded amount of work, never from wall-clock time.
- No stake doubling, coins, wallets or betting in the initial game.
- Local win/draw/loss (W/D/L) counts, by opponent and side played, and by colour in games against a friend. The first version counts them but shows none: a count cannot tell who was holding the remote, and a view that can tell the players apart comes later.
- Play the computer in a colour chosen once: **Play as** in Settings is Random by default, so OK on an opponent's card starts the game; White or Black play that colour, and Ask brings back the choice before each game (#352).
- Settings, from both menus: the music in one row, where Left and Right set the volume down to off and OK mutes it and brings it back at the same level (#350); sound effects; voices; Play as; **Host for friends** and **Turn board for friends**; and **Auto-select only choice**, off by default (#342).
- D-pad, OK and Back navigation through the board, dice, promotion, menus and results. **Main menu** in the game menu leaves a game for the home screen, and **Resume game** returns to it (#349).
- Save and resume the full game state, including the existing dice roll and remaining actions.
- A self-contained installed package as the offline target.

Online matchmaking, accounts, rankings, cloud bots and subscriptions are outside the initial MVP. Hunter is a conditional later bot; a one-time unlock is a monetization idea, not an implemented or committed purchase feature.

See [offline game scope](docs/offline-game-scope.md) for the accepted requirements, proposed statistics behavior and delivery order. This scope update supersedes the earlier single-bot MVP description in the hackathon research notes.

## Architecture

```text
native/ — the React Native for Vega application
├── Board and screens in React Native views; pieces and the opponents'
│   emoji faces drawn with @amazon-devices/react-native-svg
├── Remote input: useTVEventHandler for the D-pad, OK and Menu,
│                 useKeplerBackHandler for Back
└── Snapshot store on MMKV
        │
        ▼
src/core/ — one shared, pure TypeScript core, no DOM and no React
├── Turn controller → Dice Chess engine
├── Local bots (Rolly, Grabby, Rampage): the engine's algorithms, run on the JavaScript thread
└── Versioned game snapshot, ledger, tutorial and rules data
```

The core is pure by enforcement, not by convention: `tsconfig.core.json` typechecks it with `lib: ES2022` and `types: []`, so a DOM or Node global there fails `npm run check`. That purity is what let one verified controller serve the WebView probe and the native board at once, and what let the probe be deleted without touching the rules.

The canonical engine determines legal actions and board transitions. The controller follows each roll through the engine's legal turn tree, so a turn is checked as a whole, and takes the dice left from the engine's `applyMove` (engine 0.13.0, #101). `test/game.test.ts` and `test/dice.test.ts` cover both, and hotseat, bot and promotion turns were played this way on the Vega Virtual Device, and turns against Grabby on a Fire TV Stick (#326). Which of the dice left a legal turn can still spend, and so which dice dim, is the engine's `getPlayableDice` (engine 0.14.0, #140), covered by `test/dice.test.ts` and checked on the Vega Virtual Device; not yet checked on a Fire TV Stick. Besides resignation and an agreed draw, the controller ends a game as Fortemate's game service does: when a king is taken, after 100 halfmoves without a capture or a pawn move, checked at the end of a turn, or at turn 5,000. The board only renders state; the remote's keys reach the screen reducer through `useRemoteInput`.

The architecture, platform findings on Vega, the friction log and how the project is tested are published on the [project site](https://dicechess-tv.fortemate.com/): see [Architecture](https://dicechess-tv.fortemate.com/technology/architecture/), [Building on Vega](https://dicechess-tv.fortemate.com/technology/vega/), and [How we test and review](https://dicechess-tv.fortemate.com/quality/). [native/README.md](native/README.md) provides a terminal quick-reference for building, packaging, and installing.

This repository owns TV-specific packaging, input and application integration. Reuse appropriate public components from [dicechess-play](https://github.com/fortemate/dicechess-play) and [dicechess-engine](https://github.com/fortemate/dicechess-engine) after checking their licenses. Shared fixes should return to their source repositories.

Fire OS is a possible later target with a separate build. A Fire TV Stick 4K Select with Vega OS was bought for testing and has been in use since 6 October 2026 (#10); Samsung/Tizen, Raspberry Pi and further hardware purchases are deferred.

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

That loop closed on SDK 0.23. The native runtime gate then passed on SDK 0.24 — the WebView crash does not reproduce natively — and the board, remote input, saves, dice, menus, the first opponent (then called Random, now Rolly), the result ledger, the tutorial and the rules guide were built on that path instead. Onboarding, the submission build and testing on a Fire TV Stick followed, and 1.0.0 was released on 10 October 2026. See the [delivery roadmap](docs/roadmap.md), the [runtime gate](docs/vega-native-runtime-gate.md) and [GitHub milestones](https://github.com/fortemate/dicechess-tv/milestones).

## Hackathon

Prepared for [Build, Ship, Shape: Amazon Developer Hackathon 2026](https://amazonappdev2026.devpost.com/), Fire TV track.

- Submission deadline: **23 October 2026, 12:00 Pacific / 22:00 Europe/Riga**.
- Internal submission target: **21 October 2026**.
- Owner confirmed registration on 21 September 2026. The owner submitted 1.0.0 to the Amazon Appstore on 10 October 2026, where it awaits review; the hackathon submission itself is still to come.
- Demonstrate the actual Vega/Fire TV environment and clearly distinguish reused components from work completed during the contest window.
- Keep a reproducible SDK friction log and record tool versions from the first experiment. The log is published on the site: [Friction log](https://dicechess-tv.fortemate.com/friction-log/).

Full decisions and the detailed schedule are maintained in the private Fortemate knowledge base, starting from the page **Build, Ship, Shape — Amazon Developer Hackathon 2026**.

## Licensing

Fortemate's code in this repository is licensed under the [GNU Affero General Public License v3.0 only](LICENSE) (AGPL-3.0-only), the licence of the Dice Chess engine it runs on. Contributions are accepted under the [Contributor License Agreement](CLA.md); see [CONTRIBUTING.md](CONTRIBUTING.md).

The Fortemate name and logo, including the brand images in `native/brand/`, are not licensed under the AGPL.

Third-party material keeps its own licence, listed in the [third-party notices](THIRD_PARTY_NOTICES.md): the RhosGFX pieces and Kenney's sounds are CC0, and JDSherbert's sounds are here with the author's written permission. The four music tracks in `native/music/` are pepka-prygni's, used in this game with the author's written permission. The voice packs in `native/voices/` are Fortemate's, made with ElevenLabs, and licensed to Fortemate's Dice Chess applications only, as each pack's `LICENSE.txt` says; a fork may not use them. The characters' portraits are Fortemate's too, for its Dice Chess apps only, and are not in this repository: packages built from it, those on GitHub included, show emoji faces in their place. The package carries the licence notices of the npm packages bundled into it (#340). Amazon's `@amazon-devices/*` packages install from the public npm registry under Amazon's Program Materials License Agreement, and the Vega SDK is installed by each developer; neither is part of this repository. Check the licence of any code or asset before importing it.

Chessground's GPL-3.0-or-later obligation is gone: it was reached only by the web probe, and the probe has been removed.

## Development guidance

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup, checks and device verification, and follow [AGENTS.md](AGENTS.md). Changes go through branches and pull requests; the owner reviews and merges. Keep secrets, private models, opening books and production configuration out of this repository.

## References

- [Vega developer documentation](https://developer.amazon.com/docs/vega/0.24/vega-get-started)
- [Vega WebView](https://developer.amazon.com/docs/vega/0.24/develop-your-app-with-webview) — the abandoned path, kept for the record
- [Vega Virtual Device and device execution](https://developer.amazon.com/docs/vega/0.24/run-apps)
- [Hackathon rules](https://amazonappdev2026.devpost.com/rules)

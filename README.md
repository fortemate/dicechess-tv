# Dice Chess TV

[![Checks](https://github.com/fortemate/dicechess-tv/actions/workflows/ci.yaml/badge.svg)](https://github.com/fortemate/dicechess-tv/actions/workflows/ci.yaml)
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=fortemate_dicechess-tv&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=fortemate_dicechess-tv)
[![Coverage](https://sonarcloud.io/api/project_badges/measure?project=fortemate_dicechess-tv&metric=coverage)](https://sonarcloud.io/summary/new_code?id=fortemate_dicechess-tv)
[![License: AGPL-3.0-only](https://img.shields.io/badge/License-AGPL--3.0--only-blue.svg)](LICENSE)

Dice Chess for Amazon Fire TV: two players sharing one screen and remote, or a game against on-device bots.

## What it does

- **Play a friend** on one remote, with a host who cheers both players: Prowla the cat, Rolly or Thinkle the wizard ([What it does](https://dicechess-tv.fortemate.com/project/features/)).
- **Three local bots**, Rolly, Grabby and Rampage, from easy to hard, each one of the engine's algorithms ([Opponents](https://dicechess-tv.fortemate.com/play/opponents/)).
- **Learn to play**: a six-lesson tutorial taught aloud by Thinkle, and a rules guide ([Learning the game](https://dicechess-tv.fortemate.com/design/learning/)).
- **Adaptive music** that follows the danger to the king, with four themes by pepka-prygni ([Sound](https://dicechess-tv.fortemate.com/design/sound/)).
- **VoiceView** announcements of menus, squares, rolls, moves and results ([Controls](https://dicechess-tv.fortemate.com/play/controls/#voiceview-screen-reader)).
- **Offline**: no network code, no accounts and no analytics; games, results and settings stay on the device ([privacy policy](https://dicechess-tv.fortemate.com/privacy/)).
- **Highlights** presets: Standard, Enhanced, Color-blind and High contrast ([Readable from the sofa](https://dicechess-tv.fortemate.com/design/sofa/)).

## See it

- **Project site:** <https://dicechess-tv.fortemate.com/>, built from [`site/`](site/README.md).
- **Demo video:** <https://youtu.be/Xyz0KxkmxWU>, 2:50, published on October 19, 2026 ([`scripts/demo-video/`](scripts/demo-video/README.md)).
- **Tutorial video:** <https://youtu.be/KK8BBICjaBQ>, 4:52, recorded on the Vega Virtual Device.
- **GitHub releases:** the [releases page](https://github.com/fortemate/dicechess-tv/releases) has the latest release, its notes and its armv7, aarch64 and x86_64 packages.
- **Amazon Appstore:** [Dice Chess](https://www.amazon.com/dp/B0HL6K9N47/), free, has been live since October 20, 2026, with version 1.0.1, build 30. The newer 1.0.2 and 1.0.3 releases are on GitHub only.
- **Browser test bench:** [`web/`](web/README.md) draws the same screens in a browser for testers without an emulator. It is not device evidence.

## Try it

It needs the Vega SDK 0.24, [mise](https://mise.jdx.dev/) and either a Vega Virtual Device or a Fire TV Stick in developer mode; [native/README.md](native/README.md#building-and-running) explains the setup, and [docs/playtest.md](docs/playtest.md) installs a published release without building it.

```bash
npm ci && npm ci --prefix native
# Builds a package numbered like the newest release or beta tag, then installs
# the one built for the Virtual Device's processor and launches it
mise run device:run
```

A device refuses a package numbered lower than the one installed; [CONTRIBUTING.md](CONTRIBUTING.md#check-it-on-a-device) explains the build number. The whole game is playable with three controls, and the remote's Menu button is a shortcut:

| Remote | Virtual device keyboard | What it does                                                                                          |
| ------ | ----------------------- | ----------------------------------------------------------------------------------------------------- |
| D-pad  | Arrow keys              | Jumps between the pieces that can move, or the destinations of the one in hand; moves through menus   |
| OK     | Enter                   | Rolls the dice, picks up a piece, puts it on its destination, chooses a menu item                     |
| Back   | Esc                     | Puts a picked-up piece back, opens the game menu, closes a screen; on the home screen, leaves the app |
| Menu   | F2                      | Opens the game menu, or closes it; leaves other screens for home                                      |

The [Controls](https://dicechess-tv.fortemate.com/play/controls/) page walks through every screen and says where each key was checked.

## How it is built

```text
native/ — the React Native for Vega application
├── Board and screens in React Native views; pieces drawn with
│   @amazon-devices/react-native-svg; the characters' portraits as images,
│   or, in a build without them, the opponents' emoji faces in SVG
├── Remote input: useTVEventHandler for the D-pad, OK and Menu,
│                 useKeplerBackHandler for Back
└── Snapshot store on MMKV
        │
        ▼
src/core/ — one shared, pure TypeScript core, no DOM and no React
├── Turn controller → Dice Chess engine
├── Local bots (Rolly, Grabby, Rampage): the engine's algorithms, run in a background Hermes runtime
└── Versioned game snapshot, ledger, tutorial and rules data
```

The core is pure by enforcement: `tsconfig.core.json` typechecks it with `lib: ES2022` and `types: []`, so a DOM or Node global there fails `npm run check`. The canonical engine determines legal actions and board transitions; the board only renders state, and the remote's keys reach the screen reducer through `useRemoteInput`. The native app runs bot searches in a separate Hermes worklet runtime ([validation record](docs/opponent-runtime-validation-480.md)), and a bot's strength comes from its algorithm or a bounded amount of work, never from wall-clock time.

More on the site: [Architecture](https://dicechess-tv.fortemate.com/technology/architecture/), [Building on Vega](https://dicechess-tv.fortemate.com/technology/vega/), [Performance](https://dicechess-tv.fortemate.com/technology/performance/) and [How we test and review](https://dicechess-tv.fortemate.com/quality/). This repository owns TV-specific packaging, input and application integration; public components of [dicechess-engine](https://github.com/fortemate/dicechess-engine) and [dicechess-play](https://github.com/fortemate/dicechess-play) are reused after checking their licenses, and shared fixes return to them. After the hackathon, the first priority is more TV platforms, starting with Fire OS ([roadmap](docs/roadmap.md), M7).

## Hackathon

Prepared for [Build, Ship, Shape: Amazon Developer Hackathon 2026](https://amazonappdev2026.devpost.com/), Fire TV track. Reused: the Dice Chess engine, which existed before the contest. Built during the contest window, in a repository started on September 21, 2026: the Fire TV application, the pure core, the bots as TV opponents, the tutorial, the animations and the audio; the [Architecture](https://dicechess-tv.fortemate.com/technology/architecture/#hackathon-scope-vs-existing-foundation) page has the table. The SDK [friction log](https://dicechess-tv.fortemate.com/friction-log/) is on the site.

- Submission deadline: **October 23, 2026, 12:00 Pacific / 22:00 Europe/Riga**.
- Internal submission target: **October 21, 2026**.

## Evidence

The game installs, launches and plays on the Vega Virtual Device and, since October 6, 2026, on a Fire TV Stick 4K Select (Vega OS 1.2). Most features were played on the Virtual Device; on the Stick, a game was played with its own remote, the launch was measured, and Appstore builds 26 and 28 were checked. Evidence from the Virtual Device is not evidence from the Stick, and neither is a passing test, so each record says which it rests on: the release notes for [1.0.3, build 34](docs/release-notes-1.0.3-build34.md) and [1.0.2, build 33](docs/release-notes-1.0.2-build33.md), the [release validation of 1.0.1, build 30](docs/release-validation-1.0.1-build30.md), the [audio validation record](docs/audio-regression-validation-387.md) of October 14, 2026, the [board-navigation validation](docs/board-navigation-validation-299.md), and [docs/status-2026-10.md](docs/status-2026-10.md), the dated list of what was seen on which device.

## Licensing

Fortemate's code in this repository is licensed under the [GNU Affero General Public License v3.0 only](LICENSE) (AGPL-3.0-only), the license of the Dice Chess engine it runs on. Contributions are accepted under the [Contributor License Agreement](CLA.md); see [CONTRIBUTING.md](CONTRIBUTING.md).

The Fortemate name and logo, including the brand images in `native/brand/`, are not licensed under the AGPL.

Third-party material keeps its own license, listed in the [third-party notices](THIRD_PARTY_NOTICES.md): the RhosGFX pieces and Kenney's sounds are CC0, and JDSherbert's sounds are here with the author's written permission. The four music tracks in `native/music/` are pepka-prygni's, used in this game with the author's written permission. The voice packs in `native/voices/` are Fortemate's, made with ElevenLabs, and licensed to Fortemate's Dice Chess applications only, as each pack's `LICENSE.txt` says; a fork may not use them. The characters' portraits are Fortemate's too, for its Dice Chess apps and material presenting them only. Check the license of any code or asset before importing it.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup, checks and device verification, and follow [AGENTS.md](AGENTS.md). Changes go through branches and pull requests; the owner reviews and merges.

## References

- [Vega developer documentation](https://developer.amazon.com/docs/vega/0.24/vega-get-started)
- [Vega Virtual Device and device execution](https://developer.amazon.com/docs/vega/0.24/run-apps)
- [Hackathon rules](https://amazonappdev2026.devpost.com/rules)

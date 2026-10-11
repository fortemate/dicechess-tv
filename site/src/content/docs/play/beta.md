---
title: Get the game
description: How to get Dice Chess 1.0.0 for Fire TV, on a Fire TV Stick in developer mode or on the Vega Virtual Device, where it stands on the Amazon Appstore, and how to tell us what you found.
sidebar:
  order: 3
---

Dice Chess 1.0.0, the first release, was published on GitHub on 10 October 2026 as build 26, and again on 11 October as build 28, which replaced it. It is free and in English, and it needs no account.

## From GitHub

The [1.0.0 release, build 28](https://github.com/fortemate/dicechess-tv/releases/tag/v1.0.0%2B28), carries three packages, the same app built for three processors, and `SHA256SUMS.txt`:

| File                               | Install it on                                       |
| ---------------------------------- | --------------------------------------------------- |
| `dicechess-tv-native_armv7.vpkg`   | A Fire TV Stick with Vega OS, in developer mode     |
| `dicechess-tv-native_aarch64.vpkg` | The Vega Virtual Device on a Mac with Apple silicon |
| `dicechess-tv-native_x86_64.vpkg`  | The Vega Virtual Device on Linux or on an Intel Mac |

The characters' portraits are Fortemate's and stay out of the public repository, so in these packages the three computer opponents show emoji faces in their place, and Prowla and Thinkle show none. Otherwise they are the app submitted to the Amazon Appstore.

Check a download against `SHA256SUMS.txt`, in the folder you downloaded both to (on Linux, `sha256sum` with the same arguments):

```bash
shasum -a 256 -c SHA256SUMS.txt --ignore-missing
```

Installing needs the `vega` command line from Amazon's Vega SDK, which installs on macOS or Ubuntu ([Install the Vega SDK](https://developer.amazon.com/docs/vega/0.24/install-vega-sdk)). A Fire TV Stick needs developer mode first, as [Amazon's guide](https://developer.amazon.com/docs/vega/0.24/developer-mode) describes; on a computer, start the Virtual Device with `vega virtual-device start`. Then install and launch the package for your device, here the Stick's:

```bash
vega device install-app -p dicechess-tv-native_armv7.vpkg
vega device launch-app -a com.fortemate.dicechesstv.main
```

For the Virtual Device, install the `aarch64` or the `x86_64` package instead. With more than one device connected, add `-d` and the device's serial number, as `vega device list` shows it.

1.0.0 installs over beta 8 or a later build and keeps the game in progress, your results and your settings. A lower build cannot be installed over it. The [playtest guide](https://github.com/fortemate/dicechess-tv/blob/main/docs/playtest.md) in the repository has more on installing and removing the app.

## On the Amazon Appstore

Version 1.0.0, build 28, built from the same commit with the portraits, has been submitted to the Amazon Appstore and is awaiting Amazon's review. It replaced build 26, which was withdrawn from review before it went live. It is not in the store yet.

## What to try

- **Learn to play**, the six-lesson tutorial taught by Thinkle the wizard. A first launch offers it before anything else.
- **Play the computer**: Rolly (Easy), Grabby (Medium) or Rampage (Hard). OK on a card starts the game in the colour **Play as** names in Settings, Random unless you change it.
- **Play a friend** with someone else in the room, passing the remote. Prowla the cat hosts, unless Settings names Rolly, Thinkle or no host.
- **Rules reference**, to look something up, from the home screen or the game menu.
- The music as a game gets tense. **Settings** sets its volume, turns the sound effects and the voices on or off, and has the rows for Play as, the host, turning the board for friends and **Auto-select only choice**. [Controls](/play/controls/) describes every menu and every row.
- **Main menu** in the game menu, which leaves a game for the home screen, and **Resume game** there, which comes back to it.

## Tell us what you found

- **Without an account:** the [anonymous form](/feedback/).
- **With a GitHub account:** [Discussions](https://github.com/fortemate/dicechess-tv/discussions).
- **By email:** [hello@fortemate.com](mailto:hello@fortemate.com).

Say which build you played, and whether on a Fire TV Stick or on the Virtual Device. What confused you is as useful as what broke.

## What this build is

- **Version 1.0.0, build 28**, built from commit `d4ffdaa` with the Vega SDK 0.24. Since build 26 it narrows Auto-select only choice to the only move, and its Appstore build redraws Thinkle's hand.
- **Tested on** the Vega Virtual Device, where each feature was played, and by the app's automated tests. On a Fire TV Stick 4K Select, on 11 October 2026, the Appstore build of the same commit was installed over an earlier build, kept the saved game and opened on the home menu with no errors from the app in the device log ([release notes](https://github.com/fortemate/dicechess-tv/releases/tag/v1.0.0%2B28)). On 10 October the Appstore build of build 26 had been checked there for Settings with the music row and Play as, muting and unmuting the music, Main menu and Resume game, the opponent cards, and the confirmation before a game in play is replaced. Earlier builds were checked on the Stick for the launch, the response to the remote, the dice's tumble, the return from Home and Auto-select only choice ([Performance](/technology/performance/)).
- **Private:** it has no network code, no accounts and no analytics. Games, results and settings stay on the TV. The [privacy policy](/privacy/) has the details.
- **English only** for now.

---
title: Get the game
description: Download the published Dice Chess 1.0.2, build 33, for Vega devices, and follow preparation of 1.0.3 with character portraits.
sidebar:
  order: 3
---

Dice Chess 1.0.2, build 33, was published on GitHub on October 18, 2026. It adds Highlights, clearer rules and grouped Settings with focused control hints. It is free and in English, and it needs no account. Version 1.0.3/build 34, with consistent U.S. English and character portraits in the GitHub packages, is in preparation and is not published yet.

## From GitHub

The [1.0.2 release, build 33](https://github.com/fortemate/dicechess-tv/releases/tag/v1.0.2%2B33) carries three packages, the same app built for three processors, and `SHA256SUMS.txt`:

| File                               | Install it on                                         |
| ---------------------------------- | ----------------------------------------------------- |
| `dicechess-tv-native_armv7.vpkg`   | A Fire TV Stick 4K Select (Vega OS) in developer mode |
| `dicechess-tv-native_aarch64.vpkg` | The Vega Virtual Device on a Mac with Apple silicon   |
| `dicechess-tv-native_x86_64.vpkg`  | The Vega Virtual Device on Linux or on an Intel Mac   |

The published 1.0.2/build 33 packages omit the portraits, so the three computer opponents show emoji faces, and Prowla and Thinkle show none. The pinned portrait pack is now included in the source repository with its original notice and digests. The planned 1.0.3/build 34 packages include the ten portraits used by the app. Their license is unchanged; see [Credits and licenses](/contribute/credits/#character-portraits).

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

The 1.0.1/build 30 candidate was installed over 1.0.0/build 29 on both the Stick and the Virtual Device, preserving the game, results and settings. The final release has the same application payload. A lower build cannot be installed over a higher one. The [playtest guide](https://github.com/fortemate/dicechess-tv/blob/main/docs/playtest.md) has more on installing and removing the app.

## On the Amazon Appstore

The owner reported submitting version 1.0.1, build 30, to the Amazon Appstore for review on October 14, 2026. The separate armv7 Appstore package includes the portraits. Approval and store availability have not been confirmed; the packages linked above are available from GitHub for installation with the Vega SDK.

## What to try

- **Learn to play**, the six-lesson tutorial taught by Thinkle the wizard. A first launch offers it before anything else.
- **Play the computer**: Rolly (Easy), Grabby (Medium) or Rampage (Hard). OK on a card starts the game in the color **Play as** names in Settings, Random unless you change it.
- **Play a friend** with someone else in the room, passing the remote. Prowla the cat hosts, unless Settings names Rolly, Thinkle or no host.
- **Rules reference**, to look something up, from the home screen or the game menu.
- The music as a game gets tense. **Settings** sets its volume, turns the sound effects and the voices on or off, and has the rows for Play as, the host, turning the board for friends and **Auto-play only move**. [Controls](/play/controls/) describes every menu and every row.
- **Main menu** in the game menu, which leaves a game for the home screen, and **Resume game** there, which comes back to it.

## Tell us what you found

- **Without an account:** the [anonymous form](/feedback/).
- **With a GitHub account:** [Fortemate community discussions](https://github.com/orgs/fortemate/discussions).
- **By email:** [hello@fortemate.com](mailto:hello@fortemate.com).

Say which build you played, and whether on a Fire TV Stick or on the Virtual Device. What confused you is as useful as what broke.

## What this build is

- **Published version 1.0.2, build 33**, built from `0a196a5` with Vega SDK 0.24 and engine 0.14.8. The [release notes](https://github.com/fortemate/dicechess-tv/releases/tag/v1.0.2%2B33) and [preparation record](https://github.com/fortemate/dicechess-tv/blob/main/docs/release-preparation-1.0.2-build33.md) distinguish package checks, Virtual Device checks and owner feedback on the physical Stick.
- **Next version 1.0.3, build 34**, in preparation. The en-US application code was installed on the physical Stick from main `471cc1f` as 1.0.2/build 33 with portraits, and the owner reported that it appeared to work. That is feedback on the application code before the new version bump; it does not establish physical VoiceView listening or a new sustained-gameplay run. The [new preparation record](https://github.com/fortemate/dicechess-tv/blob/main/docs/release-preparation-1.0.3-build34.md) records candidate validation separately.
- **Private:** it has no network code, no accounts and no analytics. Games, results and settings stay on the TV. The [privacy policy](/privacy/) has the details.
- **English only** for now.

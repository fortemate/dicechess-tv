---
title: Get the game
description: Get Dice Chess on the Amazon Appstore, or download the published 1.0.3, build 34, with character portraits, for Vega devices from GitHub.
sidebar:
  order: 3
---

Dice Chess 1.0.3, build 34, was published on GitHub on October 18, 2026. It uses consistent U.S. English, and its GitHub packages include the character portraits. It follows 1.0.2, build 33, published the same day, which added Highlights, clearer rules and grouped Settings with focused control hints. It is free and in English, and it needs no account. Version 1.0.1 is also [on the Amazon Appstore](https://www.amazon.com/dp/B0HL6K9N47/).

## On the Amazon Appstore

[Dice Chess](https://www.amazon.com/dp/B0HL6K9N47/) has been free on the Amazon Appstore since October 20, 2026. On a Fire TV with Vega OS, search the Appstore for Dice Chess, or choose **Get App** on its Amazon page. The store has version 1.0.1, build 30, with the character portraits. The newer GitHub releases below are not on the store yet.

## From GitHub

The [1.0.3 release, build 34](https://github.com/fortemate/dicechess-tv/releases/tag/v1.0.3%2B34) carries three packages, the same app built for three processors, and `SHA256SUMS.txt`:

| File                               | Install it on                                         |
| ---------------------------------- | ----------------------------------------------------- |
| `dicechess-tv-native_armv7.vpkg`   | A Fire TV Stick 4K Select (Vega OS) in developer mode |
| `dicechess-tv-native_aarch64.vpkg` | The Vega Virtual Device on a Mac with Apple silicon   |
| `dicechess-tv-native_x86_64.vpkg`  | The Vega Virtual Device on Linux or on an Intel Mac   |

All three 1.0.3/build 34 packages include the ten portrait images the app uses, of Rolly, Grabby, Rampage, Prowla and Thinkle, the same as the Appstore package. The pinned portrait pack is included in the source repository with its original notice and digests, so a normal clone builds with the portraits. Their license is unchanged; see [Credits and licenses](/contribute/credits/#character-portraits). The earlier GitHub packages, up to 1.0.2/build 33, omit the portraits: there the three computer opponents show emoji faces, and Prowla and Thinkle show none.

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

Install over the existing app to keep its saved game, results and settings; removing the app deletes them. The 1.0.3/build 34 `aarch64` candidate was installed over 1.0.2/build 33 on the Virtual Device without uninstalling, and its saved data stayed byte-identical. The final packages have the same application files as that candidate. A lower build cannot be installed over a higher one. The [playtest guide](https://github.com/fortemate/dicechess-tv/blob/main/docs/playtest.md) has more on installing and removing the app.

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

- **Published version 1.0.3, build 34**, built from `57a340a` with Vega SDK 0.24 and engine 0.14.8. The [release notes](https://github.com/fortemate/dicechess-tv/releases/tag/v1.0.3%2B34) and [preparation record](https://github.com/fortemate/dicechess-tv/blob/main/docs/release-preparation-1.0.3-build34.md) distinguish package checks, Virtual Device checks and owner feedback on the physical Stick.
- **On the Stick before the version bump.** The en-US application code was installed on the physical Stick from main `471cc1f` as 1.0.2/build 33 with portraits, and the owner reported that it appeared to work. The 1.0.3/build 34 packages carry the same JavaScript and Hermes bundles, but the packages themselves, physical VoiceView listening and a new sustained-gameplay run have not been checked on the Stick.
- **Private:** it has no network code, no accounts and no analytics. Games, results and settings stay on the TV. The [privacy policy](/privacy/) has the details.
- **English only** for now.

---
title: Get the game
description: Get Dice Chess on the Amazon Appstore, or download the published 1.0.5, build 59, with character portraits and expanded voices, for Vega devices from GitHub.
sidebar:
  order: 3
---

Dice Chess 1.0.5, build 59, was published on GitHub on October 22, 2026. It adds 179 English recordings for the opponents and Hot Seat hosts (446 voice clips in total), gives rematches against the same opponent their own opening pool (`native/test/useBotVoice.test.tsx` and physical Fire TV Stick checks in the [voice expansion validation](https://github.com/fortemate/dicechess-tv/blob/main/docs/voice-expansion-validation.md)), and allows four caption rows for opponents and three for hosts (`native/test/voiceBubble.test.tsx`). It follows 1.0.4, build 58, published on GitHub on October 21, 2026, and [on the Amazon Appstore](https://www.amazon.com/dp/B0HL6K9N47/) on October 22, 2026, which moved computer-opponent searches into a separate Hermes worklet runtime (validated by automated tests, on the Vega Virtual Device and on a physical Fire TV Stick in the [opponent runtime validation](https://github.com/fortemate/dicechess-tv/blob/main/docs/opponent-runtime-validation-480.md)), finished Thinkle's cold-launch greeting before starting the next sentence (`native/test/tutorial.test.tsx` and physical Fire TV Stick listening on build 56), and deferred audio-player initialization until after the first render (validated by automated tests and on a physical Fire TV Stick in the [audio lifecycle validation](https://github.com/fortemate/dicechess-tv/blob/main/docs/audio-lifecycle-validation-479.md)). It is free and in English, and it needs no account.

## On the Amazon Appstore

[Dice Chess](https://www.amazon.com/dp/B0HL6K9N47/) has been free on the Amazon Appstore since October 20, 2026, and was updated to version 1.0.4, build 58, on October 22, 2026. On a Fire TV with Vega OS, search the Appstore for Dice Chess, or choose **Get App** on its Amazon page. The store has version 1.0.4, build 58, with the character portraits, board highlights and background worklet opponent search. Version 1.0.5, build 59, below adds the expanded voice pack on GitHub.

## From GitHub

The [1.0.5 release, build 59](https://github.com/fortemate/dicechess-tv/releases/tag/v1.0.5%2B59) carries three packages, the same app built for three processors, and `SHA256SUMS.txt`:

| File                               | Install it on                                         |
| ---------------------------------- | ----------------------------------------------------- |
| `dicechess-tv-native_armv7.vpkg`   | A Fire TV Stick 4K Select (Vega OS) in developer mode |
| `dicechess-tv-native_aarch64.vpkg` | The Vega Virtual Device on a Mac with Apple silicon   |
| `dicechess-tv-native_x86_64.vpkg`  | The Vega Virtual Device on Linux or on an Intel Mac   |

All three 1.0.5/build 59 packages include the ten portrait images the app uses, of Rolly, Grabby, Rampage, Prowla and Thinkle, and all 446 voice recordings. The pinned portrait and voice packs are included in the source repository with their original notices and digests, so a normal clone builds with them. Their licenses are unchanged; see [Credits and licenses](/contribute/credits/#character-portraits). The earlier GitHub packages, up to 1.0.2/build 33, omit the portraits: there the three computer opponents show emoji faces, and Prowla and Thinkle show none.

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

Install a developer package over an earlier developer package to keep its saved game, results and settings; removing the app deletes them. On the physical Stick, installing a developer-signed GitHub package over the Amazon-signed store version required uninstalling the store app first, which removes its saved data; keep the store installation if you need its data. Updating the developer installation on the Stick with the final 1.0.5/build 59 `armv7` package worked without uninstalling and kept the MMKV data and CRC byte-identical. Preservation through an Amazon-signed store update remains a separate check. A lower build cannot be installed over a higher one. The [playtest guide](https://github.com/fortemate/dicechess-tv/blob/main/docs/playtest.md) has more on installing and removing the app.

## What to try

- **Learn to play**, the six-lesson tutorial taught by Thinkle the wizard. A first launch offers it before anything else.
- **Play the computer**: Rolly (Easy), Grabby (Medium) or Rampage (Hard). OK on a card starts the game in the color **Play as** names in Settings, Random unless you change it.
- **Play a friend** with someone else in the room, passing the remote. Prowla the cat hosts, unless Settings names Rolly, Thinkle or no host.
- **Rules reference**, to look something up, from the home screen or the game menu.
- The music as a game gets tense. **Settings** sets the volume for music, sound effects and voices, chooses the board **Highlights** preset, and has the rows for Play as, the host, turning the board for friends and **Auto-play only move**. Physical Stick validation covered these Settings behaviors. [Controls](/play/controls/) describes every menu and every row.
- **Main menu** in the game menu, which leaves a game for the home screen, and **Resume game** there, which comes back to it.

## Tell us what you found

- **Without an account:** the [anonymous form](/feedback/).
- **With a GitHub account:** [Fortemate community discussions](https://github.com/orgs/fortemate/discussions).
- **By email:** [hello@fortemate.com](mailto:hello@fortemate.com).

Say which build you played, and whether on a Fire TV Stick or on the Virtual Device. What confused you is as useful as what broke.

## What this build is

- **Published version 1.0.5, build 59**, built from `6827541` with Vega SDK 0.24 and engine 0.14.9. The [release notes](https://github.com/fortemate/dicechess-tv/releases/tag/v1.0.5%2B59), [preparation record](https://github.com/fortemate/dicechess-tv/blob/main/docs/release-preparation-1.0.5-build59.md) and [voice expansion validation](https://github.com/fortemate/dicechess-tv/blob/main/docs/voice-expansion-validation.md) distinguish package checks, Virtual Device checks and physical Stick validation.
- **On the physical Stick.** The final 1.0.5/build 59 `armv7` archive upgraded the developer installation without uninstalling, verified all 475 installed application files by SHA-256, preserved MMKV data and CRC byte-for-byte, and passed D-pad/OK/Back checks across Settings, About, Rules, a warm Home return and a cold relaunch. Earlier same-day physical validation of the integrated 446-clip application (`3d2e1d8`) covered all settings, six tutorial lessons, all opponents and hosts with results and rematches, five short Home returns, a continuous ten-minute Rampage session, and a 179-clip native `AudioPlayer` completion and music-recovery sweep, alongside the owner's television listening check of six sampled start/result/rematch sequences. Listening to all 179 new clips on a television, physical VoiceView listening and an Amazon-signed store upgrade remain outside this validation.
- **Private:** it has no network code, no accounts and no analytics. Games, results and settings stay on the TV. The [privacy policy](/privacy/) has the details.
- **English only** for now.

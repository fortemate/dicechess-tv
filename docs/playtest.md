# Playtesting Dice Chess TV

Thank you for trying the game. This page says which package to install and how, what to try, and how to tell us what you found. It takes about twenty minutes.

## Which package

Each pre-release on the [Releases page](https://github.com/fortemate/dicechess-tv/releases) carries three packages: the same app, built for three processors.

| File                               | Install it on                                         |
| ---------------------------------- | ----------------------------------------------------- |
| `dicechess-tv-native_armv7.vpkg`   | A Fire TV Stick 4K Select (Vega OS) in developer mode |
| `dicechess-tv-native_aarch64.vpkg` | The Vega Virtual Device on a Mac with Apple silicon   |
| `dicechess-tv-native_x86_64.vpkg`  | The Vega Virtual Device on Linux or on an Intel Mac   |

Check a download against the release's `SHA256SUMS.txt`, in the folder you downloaded both to:

```bash
shasum -a 256 -c SHA256SUMS.txt --ignore-missing
```

On Linux, the command is `sha256sum` with the same arguments.

## Installing

You need the `vega` command line from the Vega SDK.

- **A Fire TV Stick:** turn on developer mode first, as [Amazon's guide](https://developer.amazon.com/docs/vega/0.24/developer-mode.html) describes.
- **A computer:** start the Virtual Device with `vega virtual-device start`.

Then install and launch the package for your device:

```bash
vega device list
vega device install-app -p dicechess-tv-native_armv7.vpkg
vega device launch-app -a com.fortemate.dicechesstv.main
```

With more than one device connected, add `-d` and the device's serial number, as `vega device list` shows it. To remove the app afterwards:

```bash
vega device uninstall-app -a com.fortemate.dicechesstv.main
```

Removing the app deletes its saved game, results and settings. They never leave the device.

## What to try

1. Start with **How to play**, the five-lesson tutorial, before reading anything else about the game.
2. Play a game against the computer: **Play the computer**, then pick Rolly (easy), Grabby (medium) or Rampage (hard). In 0.1.0 beta 1 there is one opponent, under **Play Random**.
3. If someone is with you, start a **New hotseat game** and pass the remote.
4. Look something up in **Rules**.

The whole game uses the D-pad, OK and Back; on the Virtual Device, those are the arrow keys, Enter and Esc. Keep the sound on if you can.

## Telling us what you found

- The short anonymous form: <https://fortemate.github.io/dicechess-tv/feedback/>.
- A [GitHub issue](https://github.com/fortemate/dicechess-tv/issues/new), or a reply where you found this build.

Say whether you played on a Fire TV Stick or on the Virtual Device. What confused you is as useful as what broke: where you hesitated, what you expected a button to do, which rule surprised you. For a bug, say what was on the screen and what you pressed just before.

## What this build is

- **Version.** 0.1.0, a beta for the tester round ([#107](https://github.com/fortemate/dicechess-tv/issues/107)).
- **Tested on.** So far, the app's tests and the Vega Virtual Device. It has not yet run on a Fire TV Stick ([#10](https://github.com/fortemate/dicechess-tv/issues/10)).
- **Privacy.** It has no network code, no accounts and no analytics: games, results and settings stay on the device.
- **The opponents.** Rolly plays one of its legal turns at random, Grabby takes the most valuable piece it can, and Rampage hunts your pieces and goes for your king. Each is an algorithm of the rules engine, running on the device.

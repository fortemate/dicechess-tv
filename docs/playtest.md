# Playtesting Dice Chess TV

Thank you for trying the game. This page says which package to install and how, what to try, and how to tell us what you found. It takes about twenty minutes.

## Which package

Each pre-release on the [Releases page](https://github.com/fortemate/dicechess-tv/releases) carries three packages: the same app, built for three processors. From beta 8 the computer opponents have portraits drawn for the game. They are Fortemate's and stay out of this public repository for now, so the packages here show the opponents' emoji faces in their place, and the build on the Appstore Beta Hub, below, has the portraits. The two are otherwise the same app.

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

You need the `vega` command line from the Vega SDK, which installs on macOS or Ubuntu: see [Install the Vega SDK](https://developer.amazon.com/docs/vega/0.24/install-vega-sdk). If it stopped working after you upgraded your Mac to macOS 27, the upgrade removed Rosetta, which the SDK needs: reinstall it with `softwareupdate --install-rosetta --agree-to-license`.

- **A Fire TV Stick:** turn on developer mode first, as [Amazon's guide](https://developer.amazon.com/docs/vega/0.24/developer-mode) describes. It needs an Amazon Developer account, which `vega devmode login` signs in to, and the Stick on the same network as your computer.
- **A computer:** start the Virtual Device with `vega virtual-device start`.

Then install and launch the package for your device. For a Fire TV Stick:

```bash
vega device list
vega device install-app -p dicechess-tv-native_armv7.vpkg
vega device launch-app -a com.fortemate.dicechesstv.main
```

For the Virtual Device, install `dicechess-tv-native_aarch64.vpkg` on a Mac with Apple silicon, or `dicechess-tv-native_x86_64.vpkg` on Linux or an Intel Mac, instead. With more than one device connected, add `-d` and the device's serial number, as `vega device list` shows it.

A newer beta installs over the one you have and keeps its saved game, results and settings. On the Virtual Device, beta 3 installed over beta 2 kept all three, beta 4 over beta 3 kept the last game and the results, beta 5 over beta 4 kept the game in progress and the record against the computer, beta 6 over beta 5 kept the game in progress with its dice, and so did beta 7 over beta 6 and beta 8 over beta 7. An older beta does not install over a newer one: from beta 4 on, every build carries a higher build number, and the device refuses a lower one with "Package version decrease". To go back, remove the app first, which deletes its saved game.

To remove the app:

```bash
vega device uninstall-app -a com.fortemate.dicechesstv.main
```

Removing the app deletes its saved game, results and settings. They never leave the device.

## What to try

1. Start with **How to play**, the six-lesson tutorial, before reading anything else about the game. Builds after 0.1.0 beta 8 offer it on the first launch after a fresh install (**Learn to play**). Their tutorial's last screen goes straight into a first game, against Rolly or a friend.
2. Play a game against the computer: **Play the computer**, then pick Rolly (easy), Grabby (medium) or Rampage (hard). In 0.1.0 beta 1 there is one opponent, under **Play Random**. From beta 6 the computer opponents talk: each has a face, speech bubbles and a voice of its own. From beta 7 they are fairy-tale characters, a pixie, a goblin and a little horned imp, whose voices act their lines. From beta 8 the opponent talks from beside its face at the top of the screen, and stays in full colour the whole game.
3. If someone is with you, start a **New hotseat game** and pass the remote. From beta 8, Rolly hosts it: she greets you both, cheers the big moments when a turn ends, and cheers you both at the end. While she speaks, she shows with her line above the bottom badge.
4. Look something up in **Rules**.
5. Listen to the music follow the game: calm, then tense when a roll could take a king, then critical when a king is attacked. **Settings**, in the home menu and in the game menu, turns the music, the sound effects and the voices on or off, sets the music volume, and chooses the Hot Seat host, Rolly, Prowla or off. Builds before 0.1.0 beta 3 have no music, builds before beta 6 have no voices, builds up to beta 7 call the voices **Bot voices**, beta 8 adds the Hot Seat host, and later builds add Prowla as a second one.

The whole game uses the D-pad, OK and Back; on the Virtual Device, those are the arrow keys, Enter and Esc. Keep the sound and the music on if you can.

## Telling us what you found

- **Without an account:** the short anonymous form, <https://dicechess-tv.fortemate.com/feedback/>.
- **With a GitHub account:** [Discussions](https://github.com/fortemate/dicechess-tv/discussions). Tell us what happened in a game under **General**, suggest a change under **Ideas**, and ask for help with installing under **Q&A**. One finding per discussion is easiest to follow up.
- Or reply where you found this build.

Say which build you played (the release title, such as 0.1.0 beta 3), and whether on a Fire TV Stick or on the Virtual Device. What confused you is as useful as what broke: where you hesitated, what you expected a button to do, which rule surprised you. For a bug, say what was on the screen and what you pressed just before.

We turn findings into issues and link each one in its discussion, so you can see what came of it.

## What this build is

- **Version.** 0.1.0, a beta for the tester round ([#107](https://github.com/fortemate/dicechess-tv/issues/107)).
- **Tested on.** So far, the app's tests and the Vega Virtual Device. It has not yet run on a Fire TV Stick ([#10](https://github.com/fortemate/dicechess-tv/issues/10)).
- **Privacy.** It has no network code, no accounts and no analytics: games, results and settings stay on the device.
- **The opponents.** Rolly plays one of its legal turns at random, Grabby takes the most valuable piece it can, and Rampage hunts your pieces and goes for your king. Each is an algorithm of the rules engine, running on the device.
- **The music.** Four themes by pepka-prygni, used with his permission. Against the computer the music follows the danger to your own king; with two players, to either king.

# Playtesting Dice Chess

Thank you for trying the game. This page says which package to install and how, what to try, and how to tell us what you found. It takes about twenty minutes.

## Which package

Dice Chess 1.0.0, build 26, was released on 10 October 2026. Its [release on GitHub](https://github.com/fortemate/dicechess-tv/releases/tag/v1.0.0%2B26) carries three packages: the same app, built for three processors. The characters' portraits are Fortemate's and stay out of this public repository, so these packages show the opponents' emoji faces in their place, and leave an empty space where Prowla the cat and Thinkle the wizard, who have no such face, would be. Otherwise they are the same app as the build submitted to the Amazon Appstore.

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

For the Virtual Device, install `dicechess-tv-native_aarch64.vpkg` on a Mac with Apple silicon, or `dicechess-tv-native_x86_64.vpkg` on Linux or an Intel Mac, instead. A package built for another processor installs without a word and then crashes at start. With more than one device connected, add `-d` and the device's serial number, as `vega device list` shows it.

A newer build installs over the one you have and keeps its saved game, results and settings. 1.0.0 saves them in the same format as beta 8, so installed over beta 8 or a later build it keeps them; on the Virtual Device, each beta from beta 3 to beta 8 was installed over the one before and kept the saved game. An older build does not install over a newer one: the device refuses a lower build number with "Package version decrease". To go back, remove the app first, which deletes its saved game.

To remove the app:

```bash
vega device uninstall-app -a com.fortemate.dicechesstv.main
```

Removing the app deletes its saved game, results and settings. They never leave the device.

## What to try

1. Start with **Learn to play**, the six-lesson tutorial, before reading anything else about the game. Thinkle the wizard teaches it aloud, and a first launch after a fresh install offers it. Its last screen offers a first game: **Play Rolly**, as White so that you roll first, **Play a friend**, or **Main menu**.
2. Play a game against the computer: **Play the computer**, then pick Rolly (easy), Grabby (medium) or Rampage (hard). With **Play as** in **Settings** on Random, the default, OK on a card starts the game in a colour drawn for you. White or Black plays that colour, and Ask brings back the choice of colour before each game. Each opponent talks from beside its face at the top of the screen, with a voice of its own.
3. If someone is with you, choose **Play a friend** and pass the remote after each turn. Prowla the cat hosts: she greets you both, cheers the big moments when a turn ends, and cheers you both at the end. **Settings** can choose Rolly or Thinkle instead, or no host.
4. During a game, Back opens the game menu: **Resume game**, **Resign**, **Agree a draw** in a game against a friend, **New game**, **Main menu**, **Rules reference** and **Settings**. **Main menu** leaves the game for the home screen, and **Resume game** there brings it back. Starting a new game while one is in play asks **Replace this game?** first, and **Cancel** keeps the game you have.
5. Look something up in **Rules reference**.
6. Listen to the music follow the game: calm, then tense when a roll could take a king, then critical when a king is attacked. **Settings**, in the home menu and in the game menu, has these rows:
   - **Music**: Left and Right set the volume from off to 10, and OK mutes it and brings it back at the same level.
   - **Sound effects** and **Voices**: on or off.
   - **Play as**: Ask, Random (the default), White or Black, for games against the computer.
   - **Host for friends**: Prowla (the default), Rolly, Thinkle or off.
   - **Turn board for friends**: turns the board to the side to move in a game against a friend; off by default.
   - **Auto-select only choice**: presses OK for you when the board offers only one choice, the only piece that can move or the only square it can go to; off by default.

The whole game uses the D-pad, OK and Back; on the Virtual Device, those are the arrow keys, Enter and Esc. Keep the sound and the music on if you can.

## Telling us what you found

- **Without an account:** the short anonymous form, <https://dicechess-tv.fortemate.com/feedback/>.
- **With a GitHub account:** [Discussions](https://github.com/fortemate/dicechess-tv/discussions). Tell us what happened in a game under **General**, suggest a change under **Ideas**, and ask for help with installing under **Q&A**. One finding per discussion is easiest to follow up.
- Or reply where you found this build.

Say which build you played (the release title, such as Dice Chess 1.0.0), and whether on a Fire TV Stick or on the Virtual Device. What confused you is as useful as what broke: where you hesitated, what you expected a button to do, which rule surprised you. For a bug, say what was on the screen and what you pressed just before.

We turn findings into issues and link each one in its discussion, so you can see what came of it.

## What this build is

- **Version.** 1.0.0, build 26, the first release. It was published on GitHub on 10 October 2026 and submitted to the Amazon Appstore the same day, where it awaits Amazon's review.
- **Tested on.** Automated tests, the Vega Virtual Device and a Fire TV Stick 4K Select. On 10 October 2026 the Appstore package of the same commit was checked on the Stick: the Settings rows, muting and unmuting the music, Play as on Random, Main menu and Resume game, the hint on the opponent cards, and the confirmation before a game in play is replaced, with Cancel. Most changes since beta 8 were checked in their pull requests on the Virtual Device, and the speed-ups on the Stick. Navigation checks and the physical scenarios still open are recorded in [Horizontal cycling validation](board-navigation-validation-299.md); they do not establish that every scenario has passed on this build.
- **Privacy.** It has no network code, no accounts and no analytics: games, results and settings stay on the device. The [privacy policy](https://dicechess-tv.fortemate.com/privacy/) lists what it keeps.
- **The opponents.** Rolly plays one of its legal turns at random, Grabby takes the most valuable piece it can, and Rampage hunts your pieces and goes for your king. Each is an algorithm of the rules engine, running on the device.
- **The music.** Four themes by pepka-prygni, used with his permission. Against the computer the music follows the danger to your own king; with two players, to either king.

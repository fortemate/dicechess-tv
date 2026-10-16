# Playtesting Dice Chess

Thank you for trying the game. This page says which package to install and how, what to try, and how to tell us what you found. It takes about twenty minutes.

## Which package

Dice Chess 1.0.1, build 30, was released on GitHub on 14 October 2026. Its [release on GitHub](https://github.com/fortemate/dicechess-tv/releases/tag/v1.0.1%2B30) carries three packages: the same app, built for three processors, plus `SHA256SUMS.txt`. The characters' portraits are Fortemate's and stay out of this public repository, so these packages show the opponents' emoji faces in their place, and leave an empty space where Prowla the cat and Thinkle the wizard, who have no such face, would be. The separate armv7 package for the Appstore contains those portraits.

The release includes the audio fixes from [PR #388](https://github.com/fortemate/dicechess-tv/pull/388), with version preparation merged in [PR #383](https://github.com/fortemate/dicechess-tv/pull/383). Its completed checks, final packaging and publication verification are in the [release validation record](release-validation-1.0.1-build30.md). The [audio validation record](audio-regression-validation-387.md) covers the preceding checks of the same application code, with separate device and automated evidence. The owner reported submitting 1.0.1, build 30, to the Amazon Appstore for review on 14 October 2026; approval has not been confirmed.

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

A newer build installs over the one you have and keeps its saved game, results and settings. The 1.0.1/build 30 candidate was installed over 1.0.0/build 29 on both the Stick and the Virtual Device; saved data and CRC remained byte-identical. The final release's application payload matches that candidate byte for byte ([validation record](release-validation-1.0.1-build30.md)). An older build does not install over a newer one: the device refuses a lower build number with "Package version decrease". To go back, remove the app first, which deletes its saved game.

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
6. Listen to the music follow the game: calm, then tense when enough rolls could take a king within three actions, then critical when a king is attacked. The tense measure uses the position at the start of the turn. **Settings**, in the home menu and in the game menu, has these rows:
   - **Music**, **Sounds** and **Voices**: Left and Right set the volume from off to 10, and OK mutes them and brings them back at the same level.
   - **Play as**: Ask, Random (the default), White or Black, for games against the computer.
   - **Host for friends**: Prowla (the default), Rolly, Thinkle or off.
   - **Turn board for friends**: turns the board to the side to move in a game against a friend; off by default.
   - **Auto-select only choice**: presses OK for you when the board offers only one move, one piece with one square to go to; a piece with a choice of squares, or one you pick up yourself, waits for your OK; off by default.

The whole game uses the D-pad, OK and Back; on the Virtual Device, those are the arrow keys, Enter and Esc. Keep the sound and the music on if you can.

## Release candidate checks on a Fire TV Stick

For a candidate following an OS update, run these on the physical Stick with the
package intended for the Appstore. Record the app version, build number, Stick
model and OS build before starting. Keep a copy of the earlier package and note
your saved game's position, dice, results and settings before installing over it.

1. **Update and restart.** Install over the earlier build without uninstalling.
   Check that the saved game, its remaining dice, results and settings survive.
   Force-close the app and launch it again; resume a partially played turn.
2. **Sustained play with all audio on.** Play a friend for at least ten minutes
   and Rampage for at least ten minutes, then try Rolly and Grabby. Check D-pad
   response, dice tumbles, move slides and the opponent's pace throughout.
   Report any freeze, unexpected exit or response that gets slower with play.
3. **Listen to each kind of sound.** Check rolls, rolls with nothing to play,
   moves, captures, castling, promotion and the result jingles. Listen for a
   missing start, another cue leaking after a clip, repeated speech or gaps in
   the music. Try each host and the tutorial's narration. Check music transitions
   and at least one loop of a theme.
4. **Settings while playing.** Independently mute and restore music, effects and
   voices. Change the music volume and the host. Close and reopen Settings, then
   relaunch, and check that the choices were kept. Restore your earlier settings.
5. **Leave and return.** Press Home during speech, a roll and the opponent's
   turn. No game audio should continue over the launcher. Return and check that
   the same game and dice resume, with no old cue or line replayed. Repeat this
   several times. Check Back and Menu during play, and Resume from each menu.
6. **Complete the screen flow.** Try all six tutorial lessons, Rules reference,
   About and the licence notices. Finish a game, check its result and record,
   then try Rematch. Check that Cancel keeps a game when replacing it or resigning.

Record which checks passed and which were not exercised. Include the exact
buttons and position for a failure. Technical playback logs do not establish
that every cue was audible; the listening checks need someone at the television.

## Telling us what you found

- **Without an account:** the short anonymous form, <https://dicechess-tv.fortemate.com/feedback/>.
- **With a GitHub account:** [Discussions](https://github.com/fortemate/dicechess-tv/discussions). Tell us what happened in a game under **General**, suggest a change under **Ideas**, and ask for help with installing under **Q&A**. One finding per discussion is easiest to follow up.
- Or reply where you found this build.

Say which build you played (the release title, such as Dice Chess 1.0.1, build 30), and whether on a Fire TV Stick or on the Virtual Device. What confused you is as useful as what broke: where you hesitated, what you expected a button to do, which rule surprised you. For a bug, say what was on the screen and what you pressed just before.

We turn findings into issues and link each one in its discussion, so you can see what came of it.

## What this build is

- **Published GitHub version.** 1.0.1, build 30, published on 14 October 2026 from `5a8bc32` ([release notes](https://github.com/fortemate/dicechess-tv/releases/tag/v1.0.1%2B30)), with engine 0.14.7 and the playback lifecycle fixes in PR #388.
- **Tested on.** The candidate passed 919 automated tests and separate checks on the Vega Virtual Device and a Fire TV Stick 4K Select: upgrade preservation, saved-turn recovery, settings, screen navigation and sustained play against Rampage and a friend, with shorter Rolly/Grabby runs. The final-main packages have the same application payload, and their published downloads were verified. The owner also reported checking the Stick and finding it working well. The [release validation record](release-validation-1.0.1-build30.md) retains the exact scope and limits; earlier [navigation checks](board-navigation-validation-299.md) do not establish that every scenario passed on build 30.
- **Privacy.** It has no network code, no accounts and no analytics: games, results and settings stay on the device. The [privacy policy](https://dicechess-tv.fortemate.com/privacy/) lists what it keeps.
- **The opponents.** In builds using engine 0.14.8, Rolly plays one of its legal turns at random, except that it takes your king whenever its first move can (in build 30 with engine 0.14.7 it played purely at random). Grabby takes the most valuable piece it can, and Rampage hunts your pieces and goes for your king. Each is an algorithm of the rules engine, running on the device.
- **The music.** Four themes by pepka-prygni, used with his permission. Against the computer the music follows the danger to your own king; with two players, to either king.

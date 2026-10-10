---
title: Roadmap
description: What Dice Chess for Fire TV already does, what is happening now that 1.0.0 is released, and what comes next.
---

The app was built during [Build, Ship, Shape: Amazon Developer Hackathon 2026](https://amazonappdev2026.devpost.com/). This page says where it stands.

## Done

Every feature here was played on the Vega Virtual Device, and the app's automated tests cover it. Since 6 October 2026 the game has also run on a Fire TV Stick 4K Select, though not every feature has been checked there yet. On 10 October 2026 the Appstore build of 1.0.0 was checked on the Stick for Settings with the music row and Play as, Main menu and Resume game, the opponent cards, and the confirmation before a game in play is replaced.

- **Version 1.0.0**, the first release, published on GitHub on 10 October 2026 with three packages: for a Fire TV Stick in developer mode, and for the Vega Virtual Device ([Get the game](/play/beta/)).
- **A native board** in React Native for Vega, played entirely with the remote.
- **Play a friend** on one remote, and **saving** after every action.
- **A six-lesson tutorial**, offered on the first launch and leading into a first game, and a **rules guide**.
- **Sound** for every step of the game.
- **Three computer opponents**, Rolly, Grabby and Rampage, as either colour, each with a portrait drawn for the game, speech bubbles and a synthetic voice. They are fairy-tale characters, a pixie, a goblin and a little horned imp, and their voices act their lines. An opponent talks from beside its portrait at the top of the screen. The Appstore build has the portraits; the GitHub packages show emoji faces in their place.
- **Prowla the cat, Rolly or Thinkle the wizard hosts games against a friend**: the host cheers both players at the pauses of a game and at its big moments, castling among them, and shows with the line while speaking. Settings chooses Prowla, Rolly, Thinkle or no host.
- **Moves that slide** to their squares, so an opponent's turn can be followed.
- **Dice that tumble in** on a roll, and dim when no legal turn can use them.
- **Music that follows the game**, and **Settings** for the music's volume, sound effects, voices, Play as, Host for friends, turning the board for friends, and Auto-select only choice.
- **Play as** ([#352](https://github.com/fortemate/dicechess-tv/pull/352)): the colour you play against the computer, chosen once in Settings, so OK on an opponent's card starts the game.
- **Main menu** in the game menu ([#349](https://github.com/fortemate/dicechess-tv/pull/349)), which leaves a game for the home screen; Resume game comes back to it.
- **Auto-select only choice** ([#342](https://github.com/fortemate/dicechess-tv/pull/342)), off by default: OK presses itself when the board offers only one choice.
- **A launch splash** with Thinkle conjuring the dice ([#293](https://github.com/fortemate/dicechess-tv/pull/293)), and the name **Dice Chess** throughout the app ([#328](https://github.com/fortemate/dicechess-tv/pull/328)).
- **Eight public pre-releases** before 1.0.0, with a playtest guide.

## Now

- **Amazon Appstore review:** 1.0.0 has been submitted to the Amazon Appstore and awaits Amazon's review.
- **Players' findings:** people who have never seen the game play it, from the GitHub packages on the Vega Virtual Device or a Fire TV Stick in developer mode, and tell us what they found. See [Get the game](/play/beta/).
- **Testing on a Fire TV Stick**, under way since 6 October 2026: the launch and the response to the remote have been measured there, and the opponents' and the danger search's timings are still to come ([Performance](/technology/performance/)).

## Next

What players' findings prompt comes first. Already on the list:

- a cursor that stands out when many squares are highlighted;
- a mark for the pieces that can move that reads well with colour-vision deficiency;
- a smoother first run;
- board themes and piece sets;
- translations, starting with Latvian.

Later: online play with the Fortemate community.

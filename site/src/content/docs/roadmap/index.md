---
title: Roadmap
description: What Dice Chess for Fire TV already does, what is happening now, and what comes after the tester round.
---

The app was built during [Build, Ship, Shape: Amazon Developer Hackathon 2026](https://amazonappdev2026.devpost.com/). This page says where it stands.

## Done

Every feature here was played on the Vega Virtual Device, and the app's automated tests cover it. Since 6 October 2026 the game has also run on a Fire TV Stick 4K Select, though not every feature has been checked there yet.

- **A native board** in React Native for Vega, played entirely with the remote.
- **Play a friend** on one remote, and **saving** after every action.
- **A six-lesson tutorial**, offered on the first launch and leading into a first game, and a **rules guide**.
- **Sound** for every step of the game.
- **Three computer opponents**, Rolly, Grabby and Rampage, as either colour, each with a portrait drawn for the game, speech bubbles and a synthetic voice. They are fairy-tale characters, a pixie, a goblin and a little horned imp, and their voices act their lines. An opponent talks from beside its portrait at the top of the screen. The portraits are in the build on the Appstore Beta Hub; the public packages show emoji faces in their place for now.
- **Prowla the cat, Rolly or Thinkle the wizard hosts games against a friend**: the host cheers both players at the pauses of a game and at its big moments, castling among them, and shows with the line while speaking. Settings chooses Prowla, Rolly, Thinkle or no host.
- **Moves that slide** to their squares, so an opponent's turn can be followed.
- **Dice that tumble in** on a roll, and dim when no legal turn can use them.
- **Music that follows the game**, and **Settings** for music, sound effects, voices, and turning the board for friends.
- **Eight public pre-releases**, with a playtest guide.

## Now

- **The tester round:** people who have never seen the game play it, on the Vega Virtual Device and, through Live App Testing, on their own Fire TV Sticks. See [Play the beta](/play/beta/).
- **Testing on a Fire TV Stick**, under way since 6 October 2026: the launch and the response to the remote have been measured there, and the opponents' and the danger search's timings are still to come ([Performance](/technology/performance/)).

## Next

What the tester round prompts comes first. Already on the list:

- a cursor that stands out when many squares are highlighted;
- a mark for the pieces that can move that reads well with colour-vision deficiency;
- a smoother first run;
- board themes and piece sets;
- translations, starting with Latvian.

Later: online play with the Fortemate community.

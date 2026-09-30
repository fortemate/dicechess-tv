---
title: Roadmap
description: What Dice Chess for Fire TV already does, what is happening now, and what comes after the tester round.
---

The app was built during [Build, Ship, Shape: Amazon Developer Hackathon 2026](https://amazonappdev2026.devpost.com/). This page says where it stands.

## Done

Every feature here was played on the Vega Virtual Device, and the app's automated tests cover it. None has run on a Fire TV Stick yet.

- **A native board** in React Native for Vega, played entirely with the remote.
- **Hotseat** on one remote, **saving** after every action, and the record of results.
- **A five-lesson tutorial** and a **rules guide**.
- **Sound** for every step of the game.
- **Three computer opponents**, Rolly, Grabby and Rampage, as either colour, each with a face, speech bubbles and a synthetic voice ([#155](https://github.com/fortemate/dicechess-tv/issues/155)).
- **Moves that slide** to their squares, so an opponent's turn can be followed.
- **Dice that tumble in** on a roll, and dim when no legal turn can use them.
- **Music that follows the game**, and **Settings** for music, sound effects, bot voices, and turning the board in hotseat ([#120](https://github.com/fortemate/dicechess-tv/issues/120)).
- **Six public pre-releases**, with a playtest guide.

## Now

- **The tester round:** people who have never seen the game play it, on the Vega Virtual Device and, through Live App Testing, on their own Fire TV Sticks. See [Play the beta](/dicechess-tv/play/beta/).
- **Testing on a physical Fire TV Stick**, including how fast the game runs there.
- **A demo video** of a whole game.

## Next

What the tester round prompts comes first. Already on the list:

- a cursor that stands out when many squares are highlighted ([#121](https://github.com/fortemate/dicechess-tv/issues/121));
- a mark for the pieces that can move that reads well with colour-vision deficiency ([#105](https://github.com/fortemate/dicechess-tv/issues/105));
- a smoother first run;
- board themes and piece sets ([#75](https://github.com/fortemate/dicechess-tv/issues/75));
- translations, starting with Latvian.

Later: online play with the Fortemate community.

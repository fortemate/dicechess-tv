---
title: Sound
description: 'The cues of Dice Chess for Fire TV: chosen by ear, each with something to see on the screen, easy to silence, and quiet when the app leaves the screen.'
sidebar:
  order: 3
---

Sound tells a player what happened without looking: the dice landing, a capture, the turn passing. It is never the only way to know.

## Ten cues, each with something to see

| Cue                         | What it marks                     | What the screen shows                     |
| --------------------------- | --------------------------------- | ----------------------------------------- |
| A roll                      | The dice thrown                   | The dice appear                           |
| A roll with nothing to play | No die can be used                | "No legal moves", dimmed dice, the reason |
| A move                      | A piece moved                     | The piece moves; its squares are tinted   |
| A capture                   | A piece taken                     | The piece disappears                      |
| Castling                    | King and rook moved together      | Both pieces move                          |
| A promotion                 | A pawn became another piece       | The chooser, then the new piece           |
| The handoff                 | The dice pass to the other player | The other side's name in the headline     |
| A win, a loss or a draw     | The game ended                    | The result, written out                   |

The roll, a move and a capture each have two or three takes, one picked at random, so they do not sound the same every time. Castling plays a move's sound: it is one action of the turn.

## Chosen by ear

The dice, promotion and result cues come from [Kenney](https://kenney.nl)'s CC0 sound packs. The move and capture sounds are [JDSherbert](https://jdsherbert.itch.io)'s, shown with credit on the About screen as the licence asks. Every cue was chosen by listening to the candidates. The result cues are one family of pizzicato stings, so that a win, a loss and a draw sound related but different.

The cue for a roll with nothing to play was added last ([#85](https://github.com/fortemate/dicechess-tv/issues/85)). It had to sound like bad luck rather than an error, and unlike the loss. It plays half a second after the roll, so that it follows the dice landing instead of covering them.

## Heard together, cut short where it matters

The app plays on three players: board, dice and result. A capture and the win it causes are heard together, because they are on different players. A new move on the same player cuts the last one short instead of piling sounds up.

## Silence

- **Mute.** A "Sound" item in both menus turns every cue off, and the choice is remembered. In the game menu it is one press of Up away, because the menu wraps.
- **In the background.** Sound stops when the app leaves the screen, for the launcher, the screensaver or another app, as Amazon's submission checks require.

## What has been heard, and where

The cues have been heard from the Vega Virtual Device through a computer's speakers, not yet from a television. The tests check that the players pause when the app leaves the screen. On the Virtual Device the app came back from the launcher as it left, but that nothing plays over the launcher is still to be confirmed by ear.

## Sources

- [`native/README.md`, "Sound"](https://github.com/fortemate/dicechess-tv/blob/main/native/README.md#sound): the route that plays on Vega, and what the probes found.
- [`src/core/cues.ts`](https://github.com/fortemate/dicechess-tv/blob/main/src/core/cues.ts): which cue each step of the game plays, checked against the engine in its tests.
- [#85](https://github.com/fortemate/dicechess-tv/issues/85): the empty-roll cue.

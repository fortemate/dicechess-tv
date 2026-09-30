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

- **Mute.** The Settings screen, opened from both menus, turns every cue off, and the choice is remembered. In the game menu Settings is one press of Up away, because the menu wraps.
- **In the background.** Sound stops when the app leaves the screen, for the launcher, the screensaver or another app, as Amazon's submission checks require.

## Music that follows the danger

The game has adaptive music ([#76](https://github.com/fortemate/dicechess-tv/issues/76)). The menus have their own theme. Over a game the theme follows the danger to a king, and changes at the start of each turn:

- **Calm** while neither king can be taken soon.
- **Tense** when at least a tenth of the rolls would let the side about to roll take the king within its turn.
- **Critical** when the king is attacked directly, and only the right die is missing.

Against the computer the music follows the danger to your own king. In hotseat, where both players are in the room, it follows the danger to either king. It rises at once and falls one step per turn, so one quiet turn does not drop a tense game to calm. Themes crossfade over two seconds, and a new theme starts from its beginning, as chosen by ear; after a result the music waits, so the jingle is heard on its own.

The Settings screen switches music on or off and sets its volume, apart from the sound effects. Music stops at once when the app leaves the screen.

The four themes are by pepka-prygni, made with Suno and used with his permission: Warm anticipation in the menus, then Clear Space, Tightening Layers and Tense Minor Pulse as the danger grows. A build without them plays no music, and its Settings offer only the sound effects.

## The bots speak

Against the computer, each bot says its lines aloud as well as in its speech bubble ([#159](https://github.com/fortemate/dicechess-tv/issues/159)). The voices are synthetic, made ahead of time with Amazon Polly, so nothing is generated during play and the game stays offline. Each bot's voice was chosen by ear from an audition. The recordings are dedicated to the public domain.

- **A player of its own.** A line neither cuts nor is cut by the board, dice and result cues, and a new line replaces the one being said.
- **Over the music.** The music ducks by 9 dB while a line is said, and comes back after it. A win or a loss is said after its jingle.
- **No repeats.** The same line is never said twice in a row for an event, including at the start of a rematch. The bubble stays until its line has been said.
- **A setting of its own.** The Settings screen switches the bot voices on or off apart from the sound effects. They are on by default, and they stop when the app leaves the screen.

On the Virtual Device the voice was measured at about 14 dB above the music, with the music lower between the words and back after the line.

## What has been heard, and where

The cues have been heard from the Vega Virtual Device through a computer's speakers, not yet from a television. The tests check that the players pause when the app leaves the screen. On the Virtual Device the app came back from the launcher as it left, but that nothing plays over the launcher is still to be confirmed by ear.

## Sources

- [`native/README.md`, "Sound"](https://github.com/fortemate/dicechess-tv/blob/main/native/README.md#sound): the route that plays on Vega, and what the probes found.
- [`src/core/cues.ts`](https://github.com/fortemate/dicechess-tv/blob/main/src/core/cues.ts): which cue each step of the game plays, checked against the engine in its tests.
- [#85](https://github.com/fortemate/dicechess-tv/issues/85): the empty-roll cue.

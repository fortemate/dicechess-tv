---
title: Sound
description: 'The cues and voices of Dice Chess for Fire TV: chosen by ear, each with something to see on the screen, easy to silence, and quiet when the app leaves the screen.'
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

Against the computer, each bot says its lines aloud as well as in its speech bubble ([#159](https://github.com/fortemate/dicechess-tv/issues/159)). The voices are synthetic, made ahead of time with ElevenLabs, so nothing is generated during play and the game stays offline ([#187](https://github.com/fortemate/dicechess-tv/issues/187)). Each bot is a fairy-tale character: Rolly a pixie, Grabby a goblin, Rampage a little horned imp. Each has a voice designed for it, and every line has a direction of its own: a giggle, a whisper, a roar. The recordings are Fortemate's, for its Dice Chess apps only, and are not under this repository's open licence.

- **A player of its own.** A line neither cuts nor is cut by the board, dice and result cues, and a new line replaces the one being said.
- **Over the music.** The music ducks by 9 dB while a line is said, and comes back after it. A win or a loss is said after its jingle.
- **No repeats.** The same line is never said twice in a row for an event, including at the start of a rematch. The bubble stays until its line has been said.
- **A setting of its own.** **Voices** in Settings switches every spoken line on or off, the bots' and the Hot Seat host's, apart from the sound effects. A bot's bubble stays either way. The voices are on by default, and they stop when the app leaves the screen.

On the Virtual Device the voice was measured at about 14 dB above the music, with the music lower between the words and back after the line.

## The Hot Seat host

In Hot Seat, two people sharing one remote, Rolly is the host ([#202](https://github.com/fortemate/dicechess-tv/issues/202)): a neutral party host who cheers the moment, never a side. He has 45 lines of his own, in Rolly's voice.

For now he is a voice over the game, heard and not seen. Unlike a bot's lines, his have no speech bubble yet: Hot Seat shows no face or bubble of his, keeps no room for one, and looks as it did before him. The game screen is to be redesigned once the new character portraits exist; how he appears on it waits for that.

- **Only at the pauses.** He speaks as a game starts, when a turn ends and the prompt says "OK: continue", and when the game ends. That is at most one line a turn, and never while someone is thinking.
- **A turn as a whole.** At a turn's end he picks the biggest moment of the whole turn: a queen taken, a rook, an en passant capture, a promotion, a roll with nothing to play, or a smaller capture. The first time the remote changes hands in a session, he says to pass it. At the end he cheers the winner and the other player too, or both of them for a draw.
- **Paced like every Dice Chess client.** The start, the result, en passant, a promotion and a queen are said the first two times they happen in a game. A rook or an empty roll waits a round after his last line, three times a game at most. A smaller capture waits three rounds, with a chance that halves each time it has been said. After eight quiet turns, whatever happens next is said. The numbers come from the table every Dice Chess client shares, so the TV, the web and the phone sound alike.
- **Never over himself.** A new line waits for the one being said, as long as the game waits too: once the next turn begins it is put back unheard, so a waiting line is never said while someone is thinking. Each event's lines come from a shuffled bag, so all of them are heard before any repeats, and a game never ends on the line that ended the one before, whichever side won.
- **Over the music.** His lines are said on the bots' voice player: the music ducks under them, and his result waits for its jingle.
- **Only with the board on screen.** He picks no line behind the home screen or a menu, so a game waiting at launch is quiet. The same rule keeps a bot's game restored at launch from speaking behind the home screen. A line already begun, his or a bot's, is left to finish when a menu or the home screen opens, so leaving a finished game with OK does not cut his result short. Turning him off stops his line at once, and turning the Voices off or leaving the app stops any line.
- **A setting of his own.** **Hot Seat host** in Settings chooses who hosts, or no one: it reads "Hot Seat host: Rolly" or "Hot Seat host: off", and OK or Left and Right step through the choices. Rolly is the default, and so far the only host. Off, he says nothing, and a line he is saying stops. **Voices** off silences him too.

What this rests on:

- **The Virtual Device.** Two Hot Seat games with the board turned, on an earlier build that still showed his face and picked his lines as this one does. Nothing was said at the home screen. The first game had his greeting, the pass of the remote at the end of White's first turn, a capture at the end of turn 10 and the result. The second had the greeting for another game, no second pass, and a queen taken at turn 5. Each line was about 6 dB above the music around it. On the build as it is now, Hot Seat shows no face or bubble of his, and his greeting was heard.
- **The tests.** `test/hostVoice.test.ts` checks when he speaks, what he picks from a turn, his pacing and his bags of lines. `native/test/useHostVoice.test.tsx` checks the waiting, the board-only rule and turning him off. `native/test/sound.test.ts` checks that his lines play on the voice player and that his result waits for its jingle. `native/test/soundApp.test.tsx` checks the setting, the quiet launch and a screen with no face or bubble. `native/test/vendoredVoices.test.ts` checks that his pacing is the shared table's.
- **Not yet tried on the device.** Turning him off, the board not turned, the pacing of a long game, the line after eight quiet turns, a draw, and how far the music ducks under him.

## What has been heard, and where

The cues have been heard from the Vega Virtual Device through a computer's speakers, not yet from a television. The tests check that the players pause when the app leaves the screen. On the Virtual Device the app came back from the launcher as it left, but that nothing plays over the launcher is still to be confirmed by ear.

## Sources

- [`native/README.md`, "Sound"](https://github.com/fortemate/dicechess-tv/blob/main/native/README.md#sound): the route that plays on Vega, and what the probes found.
- [`src/core/cues.ts`](https://github.com/fortemate/dicechess-tv/blob/main/src/core/cues.ts): which cue each step of the game plays, checked against the engine in its tests.
- [#85](https://github.com/fortemate/dicechess-tv/issues/85): the empty-roll cue.

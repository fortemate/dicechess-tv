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

The cue for a roll with nothing to play was added last. It had to sound like bad luck rather than an error, and unlike the loss. It plays half a second after the roll, so that it follows the dice landing instead of covering them.

## Heard together, cut short where it matters

The app plays on three players: board, dice and result. A capture and the win it causes are heard together, because they are on different players. A new move on the same player cuts the last one short instead of piling sounds up.

## Silence

- **Mute.** The Settings screen, opened from both menus, turns every cue off, and the choice is remembered. In the game menu Settings is one press of Up away, because the menu wraps.
- **In the background.** Sound stops when the app leaves the screen, for the launcher, the screensaver or another app, as Amazon's submission checks require.

## Music that follows the danger

The game has adaptive music. The menus have their own theme. Over a game the theme follows the danger to a king, and changes at the start of each turn:

- **Calm** while neither king can be taken soon.
- **Tense** when at least a tenth of the rolls would let the side about to roll take the king within its turn.
- **Critical** when the king is attacked directly, and only the right die is missing.

Against the computer the music follows the danger to your own king. In Hot Seat, where both players are in the room, it follows the danger to either king. It rises at once and falls one step per turn, so one quiet turn does not drop a tense game to calm. Themes crossfade over two seconds, and a new theme starts from its beginning, as chosen by ear; after a result the music waits, so the jingle is heard on its own.

One row of Settings holds the music, apart from the sound effects: Left and Right set its volume, down to off, and OK mutes it and brings it back at the same level (#346). The tests check each press, and on the Virtual Device the music fell silent at off and came back at its level. Music stops at once when the app leaves the screen: the tests check that the players pause, and on the Virtual Device the music's own reports showed it stopping for the launcher (#76).

The four themes are by pepka-prygni, made with Suno and used with his permission: Warm anticipation in the menus, then Clear Space, Tightening Layers and Tense Minor Pulse as the danger grows. A build without them plays no music, and its Settings offer only the sound effects.

## The bots speak

Against the computer, each bot says its lines aloud as well as in its speech bubble. The bubble stands beside the bot's portrait at the top of the panel, in a block that keeps one height whether the bot speaks or not, so nothing else on the screen moves when a line starts or ends. The block has no frame, the bubble being the only box in it, and the bot is never dimmed: it moves in a moment, so a dimmed bot would stay dark for nearly the whole game. The person's badge alone marks their turn. The voices are synthetic, made ahead of time with ElevenLabs, so nothing is generated during play and the game stays offline. Each bot is a fairy-tale character: Rolly a pixie, Grabby a goblin, Rampage a little horned imp. Each has a voice designed for it, and every line has a direction of its own: a giggle, a whisper, a roar. The recordings are Fortemate's, for its Dice Chess apps only, and are not under this repository's open licence.

- **A player of its own.** A line neither cuts nor is cut by the board, dice and result cues, and a new line replaces the one being said.
- **Over the music.** The music ducks by 9 dB while a line is said, and comes back after it. A win or a loss is said after its jingle.
- **No repeats.** The same line is never said twice in a row for an event, including at the start of a rematch. The bubble stays until its line has been said.
- **A setting of its own.** **Voices** in Settings switches every spoken line on or off, the bots' and the Hot Seat host's, apart from the sound effects. A bot's bubble stays either way. The voices are on by default, and they stop when the app leaves the screen.

On the Virtual Device the voice was measured at about 14 dB above the music, with the music lower between the words and back after the line. On 2026-10-03 the longest lines, of 55 characters, took the bubble's three rows without a cut. With the tallest panels forced, a roll with nothing to play and a result with its menu, the panel's last line stood at least 28 dp clear of the person's badge.

## The Hot Seat host

In Hot Seat, two people sharing one remote, the host is Prowla the cat, Rolly or Thinkle the wizard (#279): a neutral party host who cheers the moment, never a side. Prowla and Thinkle are not among the opponents. Each has lines of their own, in their own voice: 54 for Prowla, 48 for Rolly and 54 for Thinkle. They speak at the same moments, so what follows holds for all three. It calls the host "she", as Prowla and Rolly are; Thinkle is "he".

She is seen while she speaks. Her portrait and her line show in the free space above the bottom badge for as long as the line holds, and leave when it ends. They are placed over that space, so nothing else on the screen moves, and her last word stays with the result. A build without the portraits shows Rolly's emoji face in their place. Prowla and Thinkle have no such face: their place stays empty, the size of the portrait, so the line does not move.

- **At the pauses, and at the big moments.** She speaks as a game starts, when a turn ends and the prompt says whose turn OK starts ("OK: Black's turn"), and when the game ends. A big moment is said at once, at the action that makes it: a queen or a rook taken, an en passant capture, castling (#279), a promotion. Her lines for those are cries of the moment (Rolly's "Ooh... there goes a queen!", Prowla's "A queen falls! Oh, I adore drama.", Thinkle's "Castling! It takes a king and a rook on the dice."), and by the end of the turn the board marks another move. That is at most one line a turn, besides the result.
- **The rest of a turn as a whole.** At a turn's end she names a big moment of its last action, a roll with nothing to play, or a smaller capture anywhere in the turn, unless the turn has already had its line. The first time the remote changes hands in a session, she says to pass it. At the end she cheers the winner and the other player too, or both of them for a draw.
- **Paced like every Dice Chess client.** The start, the result, en passant, a promotion and a queen are said the first two times they happen in a game. A rook or an empty roll waits a round after her last line, three times a game at most. A smaller capture waits three rounds, with a chance that halves each time it has been said. After eight quiet turns, whatever happens next is said. The numbers come from the table every Dice Chess client shares, so the TV, the web and the phone sound alike.
- **Never over herself.** A new line waits for the one being said, as long as the game waits too: once the game takes another step it is put back unheard, so a waiting line is never said after the moment it was about. A line already begun goes on while the turn is played. Each event's lines come from a shuffled bag, so all of them are heard before any repeats, and a game never ends on the line that ended the one before, whichever side won.
- **Over the music.** Her lines are said on the bots' voice player: the music ducks under them, and her result waits for its jingle.
- **Only with the board on screen.** She picks no line behind the home screen or a menu, so a game waiting at launch is quiet. The same rule keeps a bot's game restored at launch from speaking behind the home screen. A line already begun, hers or a bot's, is left to finish when a menu or the home screen opens, so leaving a finished game with OK does not cut her result short. Turning her off stops her line at once, and turning the Voices off or leaving the app stops any line.
- **A setting of her own.** **Host for friends** in Settings chooses who hosts, or no one: it reads "Host for friends: Prowla", "Host for friends: Rolly", "Host for friends: Thinkle" or "Host for friends: off" ("Hot Seat host" until #344), and OK or Left and Right step through the choices. Prowla is the default; until 6 October 2026 Rolly was. Chosen during a session, the other host takes over from the next line: a line being said finishes, and the pass of the remote is not taught twice. Off, she says nothing, and a line she is saying stops. **Voices** off silences her too.

What this rests on:

- **Rolly on the Virtual Device.** Two Hot Seat games with the board turned, on an earlier build that still showed her face and named every moment at a turn's end. Nothing was said at the home screen. The first game had her greeting, the pass of the remote at the end of White's first turn, a capture at the end of turn 10 and the result. The second had the greeting for another game, no second pass, and a queen taken at turn 5. Each line was about 6 dB above the music around it. On a build with the portraits on 2026-10-03, her greeting showed with her face above the bottom badge, and once it was said, the panel above and below that space was the same to the pixel. With the tallest panels forced on the same day, her face and line stood clear of everything above them, 17 dp under the last item of a result's menu. At 76 dp her portrait had touched that item, so it is 64 dp. On 2026-10-04 (OS 1.2, SDK 0.24.12112), a build that started Hot Seat from a test position took a queen with the first action of a turn: her line showed and was heard at once, about 9 to 14 dB over the background, stayed on screen while the next action was played, and the turn's end said nothing more.
- **Prowla on the Virtual Device.** On 2026-10-04, Settings stepped to "Hot Seat host: Prowla", and a new Hot Seat game showed her portrait beside her greeting, with her voice over the music in the recording. In the demo video's Hot Seat game, recorded there on 2026-10-05, she greets the two players and says to pass the remote.
- **Thinkle on the Virtual Device.** On 2026-10-06 (OS 1.2, SDK 0.24.12112), Settings stepped from "Hot Seat host: Prowla" to "Rolly" and then "Thinkle". A new Hot Seat game then showed his portrait beside his greeting, "White, you roll first. The stars are watching!", and the recording, made with the music off, has about four seconds of sound there. A test build, which started Hot Seat from a position where White can castle and always rolled a king and two rooks, castled with the king's die and a rook's. His line "The king steps aside, and his tower leaps over!" showed at once while the turn went on, and its sound is in the recording. That build was never committed.
- **The tests.** `test/hostVoice.test.ts` checks when she speaks, the big moments she says at once and the one line a turn, what she picks from a turn, her pacing and her bags of lines. `native/test/useHostVoice.test.tsx` checks a queen said mid-turn under the next action, the waiting, the board-only rule and turning her off. `native/test/sound.test.ts` checks that her lines play on the voice player and that her result waits for its jingle. `native/test/soundApp.test.tsx` checks the setting, the quiet launch, that she shows above the bottom badge while she speaks, and that her last word stays with the result. `native/test/matchup.test.tsx` checks that her portrait and line stand over the free space rather than in the flow. `native/test/vendoredVoices.test.ts` checks that her pacing is the shared table's. For Prowla, `test/hostVoice.test.ts` checks that she says only her own lines, and that a new host starts with full bags and keeps what the session has seen. `native/test/hostSetting.test.ts` checks the order of the choices and that she is remembered, and `native/test/soundApp.test.tsx` that she greets in her own voice beside her portrait. `native/test/useHostVoice.test.tsx` checks that a line being said finishes when she is chosen, `native/test/matchup.test.tsx` her empty place in a build without the portraits, and `native/test/vendoredVoices.test.ts` that each of her lines has a clip recorded from its own text.
- **Not yet checked on a Fire TV Stick**, where the game has run since 6 October 2026: none of the above. **Not yet tried on the Virtual Device:** turning her off, the board not turned, the pacing of a long game, the line after eight quiet turns, a draw, and how far the music ducks under her; with Prowla, a change of host while a line is being said, and her empty place in a build without the portraits; castling in a game played from the start, by Black, or on the queen's side, and Rolly's and Prowla's castling lines.

## What has been heard, and where

The cues have been heard from the Vega Virtual Device through a computer's speakers; no listening check from a television, on a Fire TV Stick, has been recorded yet. So has the music following the danger: in a game against Rampage recorded there for the demo video, it went from calm to tense to critical as he closed in on the king, and the owner listened to it on 5 October 2026. The tests check that the players pause when the app leaves the screen. On the Virtual Device the app came back from the launcher as it left, and on a Fire TV Stick the app's own reports showed it pausing at Home and resuming on the return ([Building on Vega](/technology/vega/#leaving-the-foreground)), but that nothing plays over the launcher is still to be confirmed by ear.

## Sources

- `native/README.md`, "Sound": the route that plays on Vega, and what the probes found.
- `src/core/cues.ts`: which cue each step of the game plays, checked against the engine in its tests.

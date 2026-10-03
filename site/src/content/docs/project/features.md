---
title: What it does
description: 'A tour of Dice Chess for Fire TV: hotseat on one remote with Rolly as host, three computer opponents as either colour, the tutorial and the rules guide, saving, your record against each opponent, sound, music that follows the danger to the king, and rematch.'
sidebar:
  order: 2
---

Every screenshot here comes from the Vega Virtual Device, captured with scripted presses of the remote. Each feature was also played there, and the app's automated tests cover it; where a check is still open, the section says so. Nothing has run on a physical Fire TV Stick yet.

## Hotseat on one remote

Two players share the remote and take turns. OK rolls three dice; the pieces the dice let you move are marked green, and a die that no legal turn can use dims at once. The arrows jump between those pieces. OK picks one up and lands on one of its destinations, the arrows jump between those, and OK plays the move. Back puts a piece down again.

For living-room sofa play where players prefer to view the board from their own side, a switch in **Settings** allows turning the board so the mover's pieces sit at the bottom. When enabled, the board fades out and back in over 200 ms as the turn passes to Black or back to White, while D-pad arrow directions remain locked to the physical television screen ([#120](https://github.com/fortemate/dicechess-tv/issues/120)).

![A hotseat game: Black's knight is picked up, its destinations are dotted, a capture is ringed, and three dice sit beside the board](../../../assets/screenshots/hotseat.png)

Rolly, the friendliest of the computer opponents, hosts Hot Seat games ([#202](https://github.com/fortemate/dicechess-tv/issues/202)). He greets you both as a game starts, cheers the big moments when a turn ends, and at the end cheers the winner and the other player too. He never takes a side and speaks only at those pauses, never while someone is thinking. For now he is a voice over the game: you hear him, but unlike the computer opponents he has no speech bubble yet, and no face on the screen, so Hot Seat looks as it did before him. The game screen will be redesigned once the new character portraits exist. **Hot Seat host** in Settings chooses Rolly or off. The tests cover him; hearing him in a full game on the virtual device is still open.

## Three opponents, as either colour

![The choice of opponent: three cards, Rolly, Grabby and Rampage, each with a face, a level, a line on how it plays and your record against it](../../../assets/screenshots/opponents.png)

A person alone plays one of three opponents that run on the TV. They are chosen on cards:

- **Rolly** (Easy) plays random legal turns, an opponent for learning;
- **Grabby** (Medium) takes the most valuable piece it can;
- **Rampage** (Hard) hunts your pieces and goes for your king.

Each is an algorithm of the Dice Chess rules engine, and each card shows your record against it. The faces are RhosGFX's Vector Emojis, by the artist of the pieces. Every opponent shows its turn one action at a time, and each piece slides to its new square, the opponent's and yours alike, so a turn can be followed from the sofa. Frames recorded on the virtual device show Grabby's knight sliding onto a queen it took in under a quarter of a second, and the tests cover captures, castling, en passant and promotion.

Before the game you choose White or Black, or let the app pick a colour. Playing Black turns the board so that your pieces are at the bottom.

![The colour choice before a game against Grabby: Random, White or Black](../../../assets/screenshots/play-as.png)

![Playing Black against Grabby, with the board turned so that Black is at the bottom](../../../assets/screenshots/play-black.png)

## A roll with nothing to play

About one roll in twelve leaves nothing to play, and so do nearly a third of first rolls, measured over 300 simulated games. The screen says so instead of passing the turn silently: the headline reads "No legal moves", the dice dim, and a line under them gives the reason.

![A roll with nothing to play: the headline reads No legal moves, the three dice are dimmed, and the reason is written under them](../../../assets/screenshots/empty-roll.png)

## The tutorial

Five short lessons, each on a real position with a fixed roll, teach the game by playing it:

1. moving a piece;
2. the dice choose the pieces;
3. three actions in one turn;
4. taking a piece;
5. taking the king ends it.

A lesson never touches a saved game or the record.

![The first tutorial lesson, Moving a piece, with the pawns that can move marked](../../../assets/screenshots/tutorial.png)

## The rules guide

Nine topics, from how a game ends to castling, promotion, en passant and draws. The arrows move between topics, and the text changes without anything to open or close.

![The rules guide on the topic Use as many dice as you can](../../../assets/screenshots/rules.png)

## Saving, resuming and the record

The game is saved after every action. The app opens on the home screen, where "Resume game" continues where the game stopped: on the virtual device, a game force-stopped mid-turn and relaunched came back as it was. Your record against each computer opponent, as wins, draws and losses for each side you played, is on its card: the tests check it, and on the virtual device a card showed a win as White and a loss as Black against Grabby.

![The home screen with Resume game focused over a game in progress](../../../assets/screenshots/resume.png)

## Sound

Short cues mark each step:

- a roll, and a roll with nothing to play;
- a move, a capture, castling and a promotion;
- the handoff of the dice;
- a win, a loss or a draw.

Each was chosen by ear, and they have been heard from the virtual device through a computer's speakers, not yet from a television. Every cue also has something to see on the screen, and the Settings screen, opened from both menus, turns them all off.

Music follows the danger to your king: calm, tense when a roll could take it within a turn, and critical when it is attacked. The four themes are by pepka-prygni, used with his permission ([#76](https://github.com/fortemate/dicechess-tv/issues/76)). The Settings screen switches music on or off and sets its volume.

Sound stops when the app leaves the screen. The tests check that the players pause, and on the virtual device the app came back from the launcher as it left; that nothing plays over the launcher is still to be confirmed by ear.

![The game menu with Settings focused](../../../assets/screenshots/menu-settings.png)

## Rematch

A game against the computer ends on a choice: a rematch or the main menu. A rematch keeps your colour choice; if you chose Random, it picks again. In hotseat, a finished game stays on the board, and OK returns to the main menu.

![After resigning against Grabby: Resigned, White wins, and the choice of Rematch or Main menu](../../../assets/screenshots/rematch.png)

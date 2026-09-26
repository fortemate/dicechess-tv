---
title: What it does
description: 'A tour of Dice Chess for Fire TV: hotseat on one remote, three computer opponents as either colour, the tutorial and the rules guide, saving, the record of completed games, sound and rematch.'
sidebar:
  order: 2
---

Every screenshot here comes from the Vega Virtual Device, captured with scripted presses of the remote. Each feature was also played there, and the app's automated tests cover it; where a check is still open, the section says so. Nothing has run on a physical Fire TV Stick yet.

## Hotseat on one remote

Two players share the remote and take turns. OK rolls three dice; the pieces the dice let you move are marked green. The arrows jump between those pieces. OK picks one up and lands on one of its destinations, the arrows jump between those, and OK plays the move. Back puts a piece down again.

![A hotseat game: Black's knight is picked up, its destinations are dotted, a capture is ringed, and three dice sit beside the board](../../../assets/screenshots/hotseat.png)

## Three opponents, as either colour

![The choice of opponent: three cards, Rolly, Grabby and Rampage, each with a face, a level, a line on how it plays and your record against it](../../../assets/screenshots/opponents.png)

A person alone plays one of three opponents that run on the TV. They are chosen on cards:

- **Rolly** (Easy) plays random legal turns, an opponent for learning;
- **Grabby** (Medium) takes the most valuable piece it can;
- **Rampage** (Hard) hunts your pieces and goes for your king.

Each is an algorithm of the Dice Chess rules engine, and each card shows your record against it. The faces are RhosGFX's Vector Emojis, by the artist of the pieces. Every opponent shows its turn one action at a time.

Before the game you choose White or Black, or let the app pick a colour. Playing Black turns the board so that your pieces are at the bottom.

![The colour choice before a game against the bot: Random, White or Black](../../../assets/screenshots/play-as.png)

![Playing Black against the bot, with the board turned so that Black is at the bottom](../../../assets/screenshots/play-black.png)

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

The game is saved after every action. The app opens on the home screen, where "Resume game" continues where the game stopped: on the virtual device, a game force-stopped mid-turn and relaunched came back as it was. The home screen also keeps a record of completed games:

- hotseat games, by colour;
- games against the bot, as wins, draws and losses for each side you played.

![The home screen with Resume game focused over a game in progress, and the record of completed games below the menu](../../../assets/screenshots/resume.png)

## Sound

Short cues mark each step:

- a roll, and a roll with nothing to play;
- a move, a capture, castling and a promotion;
- the handoff of the dice;
- a win, a loss or a draw.

Each was chosen by ear, and they have been heard from the virtual device through a computer's speakers, not yet from a television. Every cue also has something to see on the screen, and a "Sound" item in both menus turns them all off.

Sound stops when the app leaves the screen. The tests check that the players pause, and on the virtual device the app came back from the launcher as it left; that nothing plays over the launcher is still to be confirmed by ear.

![The game menu with the Sound item focused](../../../assets/screenshots/menu-sound.png)

## Rematch

A game against the bot ends on a choice: a rematch or the main menu. A rematch keeps your colour choice; if you chose Random, it picks again. In hotseat, a finished game stays on the board, and OK returns to the main menu.

![After resigning against the bot: Resigned, White wins, and the choice of Rematch or Main menu](../../../assets/screenshots/rematch.png)

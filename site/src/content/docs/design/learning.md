---
title: Learning the game
description: 'How Dice Chess for Fire TV teaches its rules: a five-lesson tutorial played on real positions, a rules guide one level deep, and a notice when a roll leaves nothing to play.'
sidebar:
  order: 4
---

Most people who pick up the remote know chess, or some of it, and have never played it with dice. The app teaches the difference by playing, and keeps the reference one press away.

## The tutorial

![The first tutorial lesson, Moving a piece, with the pawns that can move marked](../../../assets/screenshots/tutorial.png)

Five short lessons, each on a real position with a fixed roll:

1. moving a piece;
2. the dice choose the pieces;
3. three actions in one turn;
4. taking a piece;
5. taking the king ends it.

Each lesson is a position, a roll and a goal, and the tests check each one against the engine. The position must decode, the roll must allow the action being taught, and the goal must be reachable. A lesson never touches a saved game or the record of completed games. Castling, promotion and en passant are left to the rules guide.

## The rules guide

![The rules guide on the topic Use as many dice as you can](../../../assets/screenshots/rules.png)

- **Nine topics**, from how a game ends to castling, promotion, en passant and draws.
- **One level deep.** The arrows move between topics, and the text changes as they do, with nothing to open or close. A remote makes every extra level expensive.
- **Checked against the engine.** The tests tie many of the guide's sentences to checks against the engine. Writing them corrected one claim: a draw by the hundred-half-move rule comes when a turn ends, not the moment the count reaches a hundred.

## A roll with nothing to play

![A roll with nothing to play: the headline reads No legal moves, the three dice are dimmed, and the reason is written under them](../../../assets/screenshots/empty-roll.png)

The rule that surprises new players most is that a roll can leave nothing to play. It is common:

- about one roll in twelve;
- nearly a third of first rolls, because at the start only pawns and knights can move (measured over 300 simulated games, [#85](https://github.com/fortemate/dicechess-tv/issues/85)).

So the app teaches the rule where it happens. The headline reads "No legal moves", the dice dim, and a line under them gives the rules guide's reason: "No die can be used — the turn passes". OK then passes the turn, but not in the first 0.7 seconds, so that a double press on the remote cannot skip the notice.

These behaviours are covered by the app's tests and were played on the Vega Virtual Device; not yet on a Fire TV Stick.

## Sources

- [`src/core/tutorial.ts`](https://github.com/fortemate/dicechess-tv/blob/main/src/core/tutorial.ts) and [`src/core/rules.ts`](https://github.com/fortemate/dicechess-tv/blob/main/src/core/rules.ts): the lessons and the guide, as data the tests check.
- [`native/README.md`, "The rules guide"](https://github.com/fortemate/dicechess-tv/blob/main/native/README.md#the-rules-guide): the guide's shape and the corrected claim.
- [#85](https://github.com/fortemate/dicechess-tv/issues/85): the empty-roll notice and its measurements.

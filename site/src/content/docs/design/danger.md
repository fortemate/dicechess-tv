---
title: Danger measure
description: How the game decides whether a king is calm, tense or in critical danger, which the music follows, with a diagram and a worked example.
sidebar:
  order: 3
---

The music follows the danger to a king ([#76](https://github.com/fortemate/dicechess-tv/issues/76)): a calm, a tense or a critical theme over a game ([Sound](/design/sound/#music-that-follows-the-danger)). This page sets out how that level is measured, at the start of every turn, in `src/core/danger.ts`. The level has one other listener: the computer opponent's threat line, said once a game on a critical turn.

## The three levels

The level is measured for the side about to roll, against one king, from the position before the roll:

| Level    | When                                                                                |
| -------- | ----------------------------------------------------------------------------------- |
| Critical | Some roll lets that side take the king with its first action.                       |
| Tense    | At least 22 of the 216 rolls (6 × 6 × 6) let it take the king within three actions. |
| Calm     | Neither.                                                                            |

Twenty-two is just over a tenth of the rolls. Any roll at all would do in a crowded middle game nearly every turn, and music that is always tense is not tense.

The measure uses the engine's pseudo-legal moves rather than the legal turn tree. A path that takes the king is legal whatever the rule of using as many dice as possible says, since taking the king ends the turn and the game. The tests check the counts against the legal turn tree.

## Whose king, from which position

| Game                     | Turn starting   | What is measured                                                        |
| ------------------------ | --------------- | ----------------------------------------------------------------------- |
| Against the computer     | The computer's  | Its threat to your king now.                                            |
| Against the computer     | Yours           | Its threat on its next turn, as if you passed (the engine's `endTurn`). |
| Play a friend (Hot Seat) | Either player's | The greater threat to either king.                                      |

Against the computer the music says "your king", never "a king": a threat you make is not news to you.

## How tense is counted

The engine calculates the threat weight through `DiceChess.threatWeight(dfen, target, maxActions)` ([#382](https://github.com/fortemate/dicechess-tv/issues/382)). It explores attacking paths up to three actions deep without dice in the position, notes the dice requirements for each path, and computes the exact number of the 216 rolls that contain those dice.

```mermaid
flowchart TB
  pos("<b>Position before the roll</b><br/>attacker to move · target king")
  crit{"<b>threatWeight</b> (1 action)<br/>takes king with first action?"}
  heard{"Music heard?"}
  weight["<b>threatWeight</b> (3 actions)<br/>exact weight of rolls taking king in <= 3 actions"]
  enough{"22 or more<br/>of 216?"}
  critical(["critical"])
  tense(["tense"])
  calm(["calm"])

  pos --> crit
  crit -- yes (> 0) --> critical
  crit -- no (= 0) --> heard
  heard -- no --> calm
  heard -- yes --> weight --> enough
  enough -- yes --> tense
  enough -- no --> calm
```

How many of the 216 rolls hold a path's dice depends only on those dice:

| A path's dice                  | Rolls that hold them |
| ------------------------------ | -------------------: |
| One piece (critical)           |                   91 |
| Two different pieces           |                   30 |
| The same piece twice           |                   16 |
| Three different pieces         |                    6 |
| A castling, then a third piece |                    6 |

So a single path with two different pieces is enough for tense (30 >= 22), while one piece moving twice needs other threats to combine to 22 rolls. Paths requiring three actions (such as three different pieces, 6 rolls) contribute additively to reach the threshold of 22 rolls. When several paths need different dice, the engine counts the distinct rolls holding any of them.

Without music the measure stops after the first step: one action tells critical from calm, which is all the threat line needs ([#368](https://github.com/fortemate/dicechess-tv/issues/368)). In a Hot Seat game without music nothing listens, so nothing is measured.

### A worked example

Black to move, `3rkb2/ppp3pp/3p2N1/4PP2/8/8/PPPK1PPP/RN5R b - - 1 7`, against the White king on d2. The rook on d8 looks down the d-file, but Black's own pawn on d6 stands in the way.

1. No first action reaches d2, so the level is not critical.
2. Of Black's 19 first actions, one opens the file: the pawn takes on e5 (`d6e5`). After it, the rook takes the king (`d8d2`).
3. That path spends a pawn die and a rook die. 30 of the 216 rolls show both.
4. 30 is 22 or more: **tense**.

On a board where a rook can reach the king only by moving twice, the path spends two rook dice. Only 16 rolls show them, so the level stays calm unless another path adds rolls.

## When it runs

Once per turn, in one slot of the app's background scheduler (`native/src/useDanger.ts`) after the frame that shows the new turn. Nothing is worked out while the turn is played, so the remote never waits for it. A new turn or leaving the game drops a measure that has not run yet. Behind a system overlay or in the background it waits, and it runs on the return.

The music then settles: it rises at once to a higher level, because a threat is news, and falls one level per turn, so one quiet turn does not drop a tense game to calm.

## Three actions restored in the engine

Until October 13, 2026, tense looked three actions deep, and each of the 56 distinct rolls was searched on its own in JavaScript. That was thousands of engine calls a turn, and on a Fire TV Stick each roll's search held the JavaScript thread for up to 2.7 s, so the cursor waited for it ([Performance](/technology/performance/#danger-evaluation--threat-analysis), [#365](https://github.com/fortemate/dicechess-tv/issues/365)). An intermediate measure looked two actions deep, which left 9 of 300 turns from seeded games calm instead of tense.

Engine 0.14.6 added `DiceChess.threatWeight` ([dicechess-engine#341](https://github.com/fortemate/dicechess-engine/pull/341), [#382](https://github.com/fortemate/dicechess-tv/issues/382)), moving the three-action search into Scala. In Node with `--jitless` it takes a median of 12.2 ms in one call, and restores the exact three-action threat measurement.

## Sources and validation

- `src/core/danger.ts`: the measure. `native/src/useDanger.ts`: when it runs, and how the level settles.
- `test/danger.test.ts` checks the first-action, two-action and three-action counts of fixed positions against the engine's legal turn tree. On 200 positions from seeded games it checks them against a search of each roll on its own (`rollByRoll(depth=3)`). It also checks that a measure without music evaluates only one action.
- `native/test/useDanger.test.tsx` checks the single slot, pausing, a replaced position, an engine fault heard as calm, and the behavior without music.
- Figures from Node and from a Fire TV Stick are on the [Performance](/technology/performance/#danger-evaluation--threat-analysis) page.

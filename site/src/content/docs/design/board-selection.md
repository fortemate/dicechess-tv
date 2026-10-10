---
title: Board selection algorithm
description: The exact current rules for directional jumps, cursor placement, destination selection and remote confirmation, with formulas and worked examples.
sidebar:
  order: 2
---

This reference describes the implementation with deliberate horizontal cycling ([issue 299](https://github.com/fortemate/dicechess-tv/issues/299)). It gives the current behavior for discussion and implementation review. [Designing for the remote](/design/remote/) explains the design decisions and historical measurements; [Controls](/play/controls/) explains how to play.

Optional [automatic rolls, issue 301](https://github.com/fortemate/dicechess-tv/issues/301), are absent from this revision and proposed to default off. The optional automatic OK on the only choice, [issue 302](https://github.com/fortemate/dicechess-tv/issues/302), is described under [The only choice](#the-only-choice); it is off by default.

## The choices and the focus state

The board keeps two squares: `cursor`, the square in focus, and `selected`, the piece in hand, or `null` before a piece is chosen. A full action normally contains two choices: choose a piece with OK, then choose its destination with OK.

The canonical engine supplies the legal actions. `viewGame` walks the prefix tree returned by `DiceChess.getLegalTurnTree`, following every action already played during this three-dice turn. The keys of the current node are the actions that may come next. These actions already obey whole-turn constraints, including maximal dice use; the board does not generate ordinary chess moves or infer permissions from a die face alone.

An action is a UCI string such as `b2b4`, with an optional promotion suffix such as `a7a8q`.

| Selection phase  | Candidate squares                                                                 |
| ---------------- | --------------------------------------------------------------------------------- |
| No piece in hand | The distinct starting squares of all current legal actions, sorted by square name |
| Piece in hand    | The distinct destination squares of legal actions starting at that piece          |

Duplicates are removed. Four promotion actions to the same square therefore produce one destination marker, but still require a later choice of promotion piece. Arrows change focus only; they never apply a move.

### A whole-turn example

In the starting position with pawn, bishop and queen dice (`[1, 3, 5]`), the legal first actions are `b2b3`, `b2b4`, `d2d3`, `d2d4`, `e2e3` and `e2e4`. The selectable pieces are therefore `b2`, `d2` and `e2`, rather than all eight pawns. These pawns open a continuation that can use the other dice.

After `b2b3`, the first-choice set becomes `c1`; after `d2d4`, it becomes `c1` and `d1`. The same navigation algorithm is applied to the newly supplied set after each action.

## Screen coordinates

For White's orientation, a file has index `0` through `7` for `a` through `h`, and a rank has index `0` through `7` for `1` through `8`. The point of a square is `(x, y) = (file, rank)`: `x` grows to the right, and `y` grows up the screen.

For a flipped board, transform both coordinates:

```text
x = 7 - file
y = 7 - rank
```

All directional scoring and screen-order ties use these transformed coordinates. Against a bot, a person playing Black sees a flipped board. Hot Seat flips for Black when its board-turning setting is enabled.

## What one arrow does

The shipped board explicitly uses the `cone` rule. The lower-level `jump` helper defaults to `axis` and `wrap: false`; the playing board explicitly uses `rule: 'cone', wrap: true`. Repeated events from a held press use `wrap: false` for that jump.

Let the cursor be `(fx, fy)`, the candidate be `(x, y)`, and the pressed direction have unit vector `(dx, dy)`:

| Arrow | `(dx, dy)` |
| ----- | ---------- |
| Up    | `(0, 1)`   |
| Down  | `(0, -1)`  |
| Left  | `(-1, 0)`  |
| Right | `(1, 0)`   |

For each candidate calculate:

```text
ahead = (x - fx) * dx + (y - fy) * dy
aside = abs((x - fx) * dy - (y - fy) * dx)
distanceSquared = ahead * ahead + aside * aside
```

For the ordinary directional search, discard candidates with `ahead <= 0`. Cycling is a separate fallback after this search.

Rank the remaining candidates by the following keys, from smallest to largest, comparing entries in order:

```text
inside the 45-degree cone, aside <= ahead:
    [0, distanceSquared, aside, -y, x]

outside the cone:
    [1, ahead + 2 * aside, aside, -y, x]
```

This means:

1. Any candidate inside the cone beats every candidate outside it, even if the outside candidate is physically nearer.
2. Inside the cone, the smallest Euclidean distance wins. Squared distance gives the same order without a square root.
3. If the cone is empty, minimize forward distance plus twice sideways distance.
4. An equal score prefers the smaller sideways distance, then the square higher on the screen, then the square further left.

If an ordinary candidate survives, it always wins, including a candidate on another rank. If none survives:

1. For a new Right press, choose the leftmost **other candidate on the same visible row**.
2. For a new Left press, choose the rightmost other candidate on that row.
3. For Up, Down, a held-key repeat, or a row with no other candidate, return `null` and keep the cursor.

The boundary is the end of the available candidates in a direction, which can occur before file `a` or `h`. Cycling never visits unavailable squares, changes rows or commits a move. The candidate set remains either movable pieces or the selected piece's destinations.

### Directional examples

| Cursor and candidates                 | Press | Result and reason                                            |
| ------------------------------------- | ----- | ------------------------------------------------------------ |
| `d2`; `b2`, `d2`, `e2`                | Left  | `b2`: the next legal choice ahead                            |
| `d2`; `b2`, `d2`, `e2`                | Right | `e2`                                                         |
| `e2`; `b2`, `d2`, `e2`                | Right | `b2` on a new press; stays at `e2` on a held repeat          |
| `d2`; `b3`, `d6`                      | Up    | `d6`: inside the cone; nearer `b3` is outside it             |
| `d4`; `e3`, `e5`                      | Right | `e5`: equal distance and sideways distance, higher on screen |
| `d4`; `c5`, `e5`                      | Up    | `c5`: equal scores and height, further left                  |
| Flipped board, `d7`; `b7`, `d7`, `e7` | Left  | `e7`, which is to the left as displayed                      |

For the sparse row `b2`, `d2`, `f2`, a new Right from `f2` goes to `b2`, and a new Left from `b2` goes to `f2`. If `g8` is also a candidate, Right from `f2` goes to `g8` instead: ordinary directional search takes precedence. With only `f2` available, all four arrows keep it focused.

On a flipped board with `b7`, `d7`, `f7`, `b7` is the rightmost displayed choice. A new Right from `b7` cycles to `f7`; a new Left from `f7` cycles to `b7`. The same rule applies to legal destination squares while holding a piece.

## How the central square is chosen

“Central” means economical to navigate from. It does not mean closest to the middle of the board or to the average geometric position.

For a fixed candidate set, create a directed graph. Each candidate has up to four outgoing edges: the results of its Up, Down, Left and Right **discrete presses**, including horizontal cycling. A route assumes release between presses; it does not describe one held gesture. A breadth-first search counts the fewest arrow presses from a proposed starting candidate to each other candidate. An edge need not be reversible with the opposite arrow.

`pressesFrom` includes the starting square at cost zero. `route` also returns a shortest sequence of directions, or `null` when there is no route. When several shortest routes exist, the search tries Up, Down, Left and Right in that order; this affects the returned route, not its length.

For each possible central candidate, calculate this key:

```text
[sumOfPresses, worstPressCount, distanceFromPreviousSquare, -y, x]
```

- `sumOfPresses`: the sum of shortest-path arrow counts to every candidate, including itself at zero.
- `worstPressCount`: the largest of those counts.
- An unreachable candidate contributes `64` to the sum and worst count.
- `distanceFromPreviousSquare`: file distance plus rank distance (Manhattan distance) to the supplied `near` square. This tie-break uses geometric steps, not jump counts. Without a `near` square it is zero.
- Final ties prefer higher on screen, then further left.

Choose the smallest key lexicographically. An empty set returns `null`. The evaluator can request a historical `stepwise` variant that substitutes Manhattan distance for graph press counts; the playing board uses graph counts.

For `b2`, `d2`, `e2`:

| Starting candidate | Presses to the three candidates | Sum | Worst |
| ------------------ | ------------------------------- | --: | ----: |
| `b2`               | `0`, `1`, `1`                   |   2 |     1 |
| `d2`               | `1`, `0`, `1`                   |   2 |     1 |
| `e2`               | `1`, `1`, `0`                   |   2 |     1 |

Before cycling, `d2` minimized the sum. Now all three tie: with no previous square, reading order picks `b2`; with `near = e1`, proximity picks `e2`. Adding edges can change the initial candidate and the reachability check used for likely destinations. Capture and double-push priorities themselves are unchanged. With two equally central choices, `c3` and `f3`, a previous cursor at `g1` breaks the tie in favor of `f3`; one at `b1` favors `c3`.

## Where the cursor waits after a roll or action

When the human side is in the move phase, `waitingFocus` applies a sticky policy:

1. If the current cursor square is still a movable piece, keep it.
2. Otherwise choose the central movable piece, using the current cursor as `near`.
3. With no movable piece, keep the cursor square.
4. Clear the piece in hand.

A new game seeds focus at `e2` for the normal orientation, or `e7` for the flipped orientation. The seed is subsequently settled onto a legal choice. For the pawn/bishop/queen example, `e2` itself is legal, so the cursor stays on `e2` without needing to calculate centrality. In the opening with only the `b1` and `g1` knights available, the `e2` seed settles on `g1` because it is nearer.

After a move, the old cursor is normally its destination. It remains there if that square now holds a piece that can act again during this turn. Otherwise it settles onto a central movable piece. On the bot's turn or outside the move phase, the screen clears selection without choosing a new human candidate.

The cursor frame is hidden before the roll, at the handoff, on the bot's turn, after the game ends, and behind a menu. It appears when there is a human board choice.

## Where OK lands after picking up a piece

Let `D` be the distinct legal destinations of the chosen piece. With the current board available, the board tries a likely destination before the general centrality calculation:

1. Find destinations that capture an opposing piece. Their ranking values are pawn `1`, knight `3`, bishop `3`, rook `5`, queen `9`, king `100`. These are cursor-placement values; capturing a king ends Dice Chess.
2. Prefer the highest-valued capture. For equally valued captures, run `central` over only those tied capture squares, with the chosen piece as `near`.
3. A legal pawn move to a different file onto an empty square counts as an en-passant pawn capture.
4. With no capture, prefer a legal two-square push by a pawn on its starting rank: White's rank 2 or Black's rank 7.
5. If neither applies, use `central(D, chosenPiece)`.

There is a reachability check before accepting a likely capture or double push: `pressesFrom(preferred, D)` must contain every destination. If it does not, use `central(D, chosenPiece)` instead. Without the board field, the helper also goes straight to centrality because it cannot identify captures or pawns.

The fallback is an optimization with an unreachable penalty, not a mathematical promise that every arbitrary candidate set is navigable from every starting square. Historical random-set checks also do not prove that universal claim.

| Position or available actions                           | Initial destination                                     |
| ------------------------------------------------------- | ------------------------------------------------------- |
| Starting `e2` pawn with `e2e3`, `e2e4`                  | `e4`; Down reaches `e3` in the normal orientation       |
| Same actions, but no board field supplied to the helper | `e3`, the nearer of two equally central destinations    |
| Pawn can capture a knight or push two                   | The knight capture                                      |
| `e5d6` is en passant and `e5e6` is quiet                | `d6`                                                    |
| Rook can capture the king on `a8` or queen on `h1`      | `a8`, if every destination remains reachable from there |
| Piece has one destination and one complete legal action | That destination; OK to pick up, then OK to move        |

## Confirmation, promotion and cancellation

With a piece selected, OK searches the legal actions for its starting square and the cursor's destination. One matching action emits a move intent for the controller to validate and apply. Multiple matches emit a promotion choice, ordered queen, rook, bishop, knight; the highlighted destination alone does not settle that choice.

When the cursor is not a destination of the selected piece but stands on another piece that can act, OK can pick up that piece instead. Normal directional navigation with a piece in hand remains confined to its destinations; it does not separately cycle through other pieces.

Back with a piece in hand puts it down and returns the cursor to its starting square. Back with no selection opens the game menu. Menu opens the game menu immediately and also puts down a selected piece. On the home screen, Back allows the application to exit.

## Native key events and pacing

`useRemoteInput` maps `select`, `enter` and `kpenter` to OK. Direction keys are delivered on key-down (`eventKeyAction === 0`) and on repeats while held. OK is delivered once on release (`eventKeyAction === 1`); its down/repeat events only show the pressed state. Menu is also delivered on release. Back uses the consuming `useKeplerBackHandler` channel.

The native hook records which direction keys are down. The first down event is a new press; subsequent down events before release carry `repeat: true` to the board reducer. A key-up event removes the held marker. Both the game and tutorial pass this metadata to the shared board algorithm.

For all eight starting pawns, holding Right from `e2` walks `f2`, `g2`, `h2` and stops. Release, then a new Right, cycles to `a2`. If that new press is held, subsequent repeats walk normally towards `h2` and stop there; they cannot cycle again. Left behaves symmetrically.

Changing the input context (selection, phase or overlay), losing app focus, or entering a non-active app state cancels OK and its pressed feedback. A direction remains physically held until its release event, including across context and lifecycle changes; opening and closing a menu during a Right hold cannot enable cycling. While inactive or blurred, direction events update this bookkeeping without moving focus; other remote events are ignored and Back is claimed so it cannot invoke the platform's default exit. A discarded OK press cannot re-arm on repeated down events or confirm anything on its later release; a fresh press after release is required. If the platform omits a release while the app is inactive, the next down remains conservatively a repeat until a release is observed. Menu repeats and OK confirmation retain their normal semantics.

Human rolls require OK. In Hot Seat, OK at the handoff both changes the side to move and rolls that player's dice. Against a bot, OK after the human turn hands play to the bot, which already rolls and moves automatically; after a normal bot turn, the human is left waiting to roll. A bot's empty roll stays visible until the human's OK passes it and rolls the human's dice. After any empty roll, a `700 ms` OK guard prevents a quick second press from dismissing the notice immediately.

### The only choice

With **Auto-select only choice** off, the default, even a unique human action needs confirmation. A single destination removes the arrow presses, but still needs OK to pick up the piece and OK to play, with promotion resolved separately when necessary.

With the setting on, OK presses itself whenever the press has exactly one possible target. `onlyChoice` in `src/core/boardInput.ts` reads the same candidate sets the arrows walk:

| Selection phase  | OK presses itself when                   | What the press does                                                                                  |
| ---------------- | ---------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| No piece in hand | Exactly one square starts a legal action | Picks that piece up; the cursor lands as for a manual pick                                           |
| Piece in hand    | That piece has exactly one destination   | Plays the action to it, or, when several promotions reach that square, opens the choice of promotion |

Uniqueness is judged at each step, not over the whole action: a lone piece with several destinations is picked up, and the destination stays the person's choice. A piece in hand qualifies however it was picked up. The promotion piece is never chosen automatically. In the starting position with rook, rook and knight (`[4, 4, 2]`), the two knights and then the knight's two destinations are the person's choices; after `b1c3` only `a1` can act, only on `b1`, and the second rook die can only take it back to `a1`, so four presses of OK are made automatically.

It applies only on the board while a person chooses an action: never to a bot, a roll, a handoff, an ended game, behind an overlay, or in the tutorial, whose board has its own reducer and stays manual. Each automatic press is scheduled `600 ms` (the bot's step) after the state it was computed from, through the same foreground-aware scheduling as the bot's steps, and names the game revision and the piece in hand it was computed for. A press of the person's own, an action played, or a callback that arrives late finds nothing to do, and the next press is scheduled for the state on screen, so a chain plays one visible step at a time.

While a press is pending the prompt reads "Only one choice · Back: stop". Back then only stops it: the cursor and any piece in hand stay where they are, and a second Back puts the piece down or opens the menu as usual. Menu stops it on the way to the menu, and Back from the choice of promotion piece stops it with the pawn in hand. A stopped action is the person's to finish; automatic presses return when the game revision changes, with the next action.

## What the press measurements mean

The evaluator in `scripts/cursor-presses.ts` replays seeded games and uses the same navigation helpers. An action's cost includes arrow presses, one OK to choose a piece and one OK to choose a destination; a promotion adds another OK. If a target is unreachable under an evaluated strategy, the evaluator records that fact and uses square-by-square distance for its cost fallback.

The figures on [Designing for the remote](/design/remote/) are the recorded simulation of the existing designs, including their initial placement and landing policies. They do not measure physical Stick usability, animation time, hesitation, held-key duration, or the benefit of the added cycling, the automatic OK on the only choice, or the proposed automatic roll.

The evaluator has an explicit `wrap` flag, defaulting off for historical strategies; its current cyclic strategy enables it for placement, landing and paths. The old rows retain their original graph. New cyclic measurements have not replaced the historical figures. For future comparisons, retain the same positions and moves, distinguish the two selection phases, and report changes to both shortest routes and initial cursor placement. Altering navigation edges can also change which candidate `central` chooses and whether a likely landing passes its reachability check.

## Sources and validation boundaries

The source links below are pinned to the implementation revision:

- [Legal turn-tree traversal: `src/core/game.ts`](https://github.com/fortemate/dicechess-tv/blob/b7144d1e2c03f2fd83b736ad646c771e41fbc00c/src/core/game.ts).
- [Directional scoring, shortest paths and centrality: `src/core/cursor.ts`](https://github.com/fortemate/dicechess-tv/blob/b7144d1e2c03f2fd83b736ad646c771e41fbc00c/src/core/cursor.ts).
- [Candidates, landing and board intent: `src/core/boardInput.ts`](https://github.com/fortemate/dicechess-tv/blob/b7144d1e2c03f2fd83b736ad646c771e41fbc00c/src/core/boardInput.ts).
- [Phase transitions and cursor seeds: `native/src/screen.ts`](https://github.com/fortemate/dicechess-tv/blob/b7144d1e2c03f2fd83b736ad646c771e41fbc00c/native/src/screen.ts).
- [Cursor visibility: `native/src/GameScreen.tsx`](https://github.com/fortemate/dicechess-tv/blob/b7144d1e2c03f2fd83b736ad646c771e41fbc00c/native/src/GameScreen.tsx).
- [Key normalization and repeats: `native/src/useRemoteInput.ts`](https://github.com/fortemate/dicechess-tv/blob/b7144d1e2c03f2fd83b736ad646c771e41fbc00c/native/src/useRemoteInput.ts).
- [Press accounting: `src/core/presses.ts`](https://github.com/fortemate/dicechess-tv/blob/b7144d1e2c03f2fd83b736ad646c771e41fbc00c/src/core/presses.ts).
- [Cursor examples](https://github.com/fortemate/dicechess-tv/blob/b7144d1e2c03f2fd83b736ad646c771e41fbc00c/test/cursor.test.ts) and [board-input examples](https://github.com/fortemate/dicechess-tv/blob/b7144d1e2c03f2fd83b736ad646c771e41fbc00c/test/boardInput.test.ts).

This is a description checked against source and tests. Earlier design validation includes the Vega Virtual Device; on 9 October 2026 the owner reported physical Fire TV Stick testing and the end-of-row feedback tracked in issue 299. Physical controlled-position build 22 subsequently verified both boundaries, short presses, holds, sparse choices, destinations and flipped orientation. Normal build 23 was installed afterward and checked with D-pad, OK and Back while retaining the original saved game. Context/lifecycle hold retention and canceled OK repeats have automated regression evidence; the additional physical multi-key attempt did not establish that scenario. The [validation record](https://github.com/fortemate/dicechess-tv/blob/feat/299-horizontal-wrap/docs/board-navigation-validation-299.md) identifies the revisions, packages and sequences; tests and device results retain their distinct scopes.

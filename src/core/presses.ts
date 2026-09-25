// How many presses of the remote one action takes under each way of moving the
// cursor that #68 compares, so the choice can be measured rather than argued.
//
// An action is two choices: the piece, then its destination. Each costs the
// arrow presses that reach it plus one OK, and a promotion adds one OK more.

import { central, pressesFrom, steps, type JumpRule } from './cursor.ts';
import { movableSquares } from './highlights.ts';

export type Strategy = {
  // While choosing a piece, a press moves one square, or jumps to the next
  // square an action can start from.
  pieces: 'step' | 'jump';
  // Where the cursor waits for that choice: where it was left; on the central
  // movable piece; or where it was left while that piece can still move, and on
  // the central one otherwise.
  start: 'stay' | 'central' | 'sticky';
  // While choosing a destination, a press moves one square from the piece, or
  // the cursor lands on the central destination and jumps between destinations.
  destinations: 'step' | 'jump';
  rule: JumpRule;
};

// The board today: the cursor stays where it was, and every press moves it one
// square.
export const CURRENT: Strategy = {
  pieces: 'step',
  start: 'stay',
  destinations: 'step',
  rule: 'axis',
};

export type Cost = {
  presses: number;
  // False when jumps alone could not reach a choice; that choice is then
  // counted a square per press.
  reachable: boolean;
};

export function actionCost(
  strategy: Strategy,
  cursor: string,
  legal: readonly string[],
  move: string,
  flipped = false,
): Cost {
  const layout = { rule: strategy.rule, flipped };
  const from = move.slice(0, 2);
  const to = move.slice(2, 4);
  let reachable = true;
  const reach = (start: string, options: readonly string[], target: string) => {
    const presses = pressesFrom(start, options, layout).get(target);
    if (presses !== undefined) return presses;
    reachable = false;
    return steps(start, target);
  };

  const pieces = movableSquares(legal);
  const stepwise = strategy.pieces === 'step';
  const stays =
    strategy.start === 'stay' ||
    (strategy.start === 'sticky' && pieces.includes(cursor));
  const start = stays
    ? cursor
    : (central(pieces, cursor, { ...layout, stepwise }) ?? cursor);
  let presses = stepwise ? steps(start, from) : reach(start, pieces, from);

  if (strategy.destinations === 'step') presses += steps(from, to);
  else {
    const targets = [
      ...new Set(
        legal
          .filter((action) => action.slice(0, 2) === from)
          .map((action) => action.slice(2, 4)),
      ),
    ];
    presses += reach(central(targets, from, layout) ?? from, targets, to);
  }
  return { presses: presses + 2 + (move.length > 4 ? 1 : 0), reachable };
}

// Remote input for the board: where the cursor goes and what the player meant.
//
// The board emits intent, not moves. This reducer takes the focus state and a
// key and returns the new focus plus, when the player has committed to
// something, an action for the controller to validate and apply. It decides no
// legality of its own: the legal actions are an input, exactly as the engine
// reported them.
//
// Arrows jump between the squares the current choice can go to, the way focus
// moves between the items of a TV menu (#68): the pieces that can move, or,
// once one is picked up, its destinations. Every press lands on an option.
//
// The key names are Vega's own remote vocabulary, so the native layer passes
// them through unchanged.

import type { Square } from './board.ts';
import { central, jump, RULE } from './cursor.ts';

export type BoardKey = 'up' | 'down' | 'left' | 'right' | 'select' | 'back';

export type BoardFocus = {
  cursor: Square;
  selected: Square | null;
};

export type BoardAction =
  // Nothing for the controller to do; the focus may still have changed.
  | { type: 'none' }
  // A single legal action the player chose.
  | { type: 'move'; move: string }
  // The destination is legal by more than one promotion suffix, so the player
  // still has to choose. The board does not pick for them.
  | { type: 'promote'; moves: string[] }
  // Back with nothing selected: the caller decides what leaving means.
  | { type: 'exit' };

export type BoardInputResult = {
  focus: BoardFocus;
  action: BoardAction;
};

const bySquare = (a: string, b: string) => a.localeCompare(b);

// A promotion is offered queen first, then rook, bishop and knight, whatever
// order the legal actions come in: the engine's turn tree lists them by UCI.
const PROMOTION = 'qrbn';
const byPromotion = (a: string, b: string) =>
  PROMOTION.indexOf(a.slice(4)) - PROMOTION.indexOf(b.slice(4));

// Legal actions that start on a square, so a square is known to be selectable.
export function movesFrom(legal: readonly string[], square: string): string[] {
  return legal.filter((move) => move.slice(0, 2) === square);
}

// The squares legal actions start from, sorted so that equal sets compare equal.
export function movableSquares(legal: readonly string[]): string[] {
  return [...new Set(legal.map((move) => move.slice(0, 2)))].sort(bySquare);
}

// Where a piece can go, once each.
const destinationsOf = (legal: readonly string[], square: string): string[] => [
  ...new Set(movesFrom(legal, square).map((move) => move.slice(2, 4))),
];

// Where the cursor waits for the next choice of piece, with nothing picked up:
// on its square while that piece can still move, otherwise on the central
// movable piece. With nothing to choose, it stays where it is.
export function waitingFocus(
  cursor: Square,
  legal: readonly string[],
  flipped = false,
): BoardFocus {
  const pieces = movableSquares(legal);
  const square = pieces.includes(cursor)
    ? cursor
    : (central(pieces, cursor, { rule: RULE, flipped }) ?? cursor);
  return { cursor: square as Square, selected: null };
}

// `flipped` is the board turned for a person playing Black: the arrows still
// move the cursor the way they point on the screen.
export function boardInput(
  focus: BoardFocus,
  key: BoardKey,
  legal: readonly string[],
  flipped = false,
): BoardInputResult {
  const layout = { rule: RULE, flipped };
  if (key === 'back') {
    // Back never leaves the player stuck: it puts a picked-up piece down, with
    // the cursor back on it, and otherwise hands the decision up.
    return focus.selected
      ? {
          focus: { cursor: focus.selected, selected: null },
          action: { type: 'none' },
        }
      : { focus, action: { type: 'exit' } };
  }

  if (key !== 'select') {
    const options = focus.selected
      ? destinationsOf(legal, focus.selected)
      : movableSquares(legal);
    const cursor = jump(focus.cursor, options, key, layout) ?? focus.cursor;
    return {
      focus: { ...focus, cursor: cursor as Square },
      action: { type: 'none' },
    };
  }

  const matches = focus.selected
    ? legal.filter(
        (move) =>
          move.slice(0, 2) === focus.selected &&
          move.slice(2, 4) === focus.cursor,
      )
    : [];
  if (matches.length > 1) {
    matches.sort(byPromotion);
    return { focus, action: { type: 'promote', moves: matches } };
  }
  if (matches.length === 1) {
    return { focus, action: { type: 'move', move: matches[0] } };
  }
  // Not a destination. If the cursor holds a piece that can act, pick it up and
  // land on its central destination; that also switches pieces without a
  // press of Back first. With one destination, OK then OK plays the move.
  if (movesFrom(legal, focus.cursor).length) {
    const landing =
      central(destinationsOf(legal, focus.cursor), focus.cursor, layout) ??
      focus.cursor;
    return {
      focus: { cursor: landing as Square, selected: focus.cursor },
      action: { type: 'none' },
    };
  }
  return { focus, action: { type: 'none' } };
}

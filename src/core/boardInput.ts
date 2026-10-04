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

import { fileOf, pieceAt, rankOf, type Square } from './board.ts';
import { central, jump, pressesFrom, RULE, type Layout } from './cursor.ts';

export type BoardKey =
  'up' | 'down' | 'left' | 'right' | 'select' | 'back' | 'menu';

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

// The square two ahead of a pawn on its starting rank, when the pawn stands on
// `square` of `board` (the FEN board field), or null for any other piece.
function doublePush(board: string, square: string): string | null {
  const piece = pieceAt(board, square);
  const rank = rankOf(square);
  if (piece === 'P' && rank === 1) return square[0] + 4;
  if (piece === 'p' && rank === 6) return square[0] + 5;
  return null;
}

// What a piece is worth to the landing below. The king is worth the most:
// taking it ends the game.
const WORTH: Readonly<Record<string, number>> = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  k: 100,
};

const isWhite = (piece: string) => piece === piece.toUpperCase();

// The worth of what the piece on `square` of `board` takes by moving to `to`,
// or 0 when the move takes nothing. A legal pawn move that changes file always
// takes: onto an empty square it takes en passant, and so takes a pawn.
function takes(board: string, square: string, to: string): number {
  const piece = pieceAt(board, square);
  if (piece === null) return 0;
  const target = pieceAt(board, to);
  if (target !== null)
    return isWhite(target) === isWhite(piece) ? 0 : WORTH[target.toLowerCase()];
  return piece.toLowerCase() === 'p' && fileOf(to) !== fileOf(square)
    ? WORTH.p
    : 0;
}

// The destination players usually choose, when the board makes one likely:
// the most valuable piece it can take, since players take far more often than
// not, and between equal captures the central one; failing a capture, a pawn's
// two-square push, which players usually choose over the single step.
function likely(
  destinations: readonly string[],
  square: string,
  layout: Layout,
  board: string,
): string | null {
  let best = 0;
  let captures: string[] = [];
  for (const to of destinations) {
    const worth = takes(board, square, to);
    if (worth > best) {
      best = worth;
      captures = [to];
    } else if (worth > 0 && worth === best) captures.push(to);
  }
  if (captures.length) return central(captures, square, layout);
  const far = doublePush(board, square);
  return far !== null && destinations.includes(far) ? far : null;
}

// Where the cursor lands once the piece on `square` is picked up: on the
// likely destination, so that the usual move needs no arrow, and otherwise on
// the central one. Arrows do not reach every destination from every square: a
// few are reached only by landing on them, which `central` allows for. So a
// likely destination that would leave another out of reach gives way to the
// central one. Without the board the landing is the central destination.
export function landing(
  legal: readonly string[],
  square: string,
  layout: Layout,
  board: string | null = null,
): string | null {
  const destinations = destinationsOf(legal, square);
  const preferred =
    board === null ? null : likely(destinations, square, layout, board);
  if (
    preferred !== null &&
    pressesFrom(preferred, destinations, layout).size === destinations.length
  )
    return preferred;
  return central(destinations, square, layout);
}

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
// move the cursor the way they point on the screen. `board` is the FEN board
// field, which tells where the cursor lands: on a capture, or on a pawn's
// two-square push.
export function boardInput(
  focus: BoardFocus,
  key: BoardKey,
  legal: readonly string[],
  flipped = false,
  board: string | null = null,
): BoardInputResult {
  const layout = { rule: RULE, flipped };
  if (key === 'menu') {
    // Menu opens the menu overlay immediately: if a piece was picked up, it
    // is put back down first so the board is clean when returning.
    return {
      focus: focus.selected
        ? { cursor: focus.selected, selected: null }
        : focus,
      action: { type: 'exit' },
    };
  }

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
  // land on one of its destinations (see `landing`); that also switches pieces
  // without a press of Back first. With one destination, OK then OK plays the
  // move.
  if (movesFrom(legal, focus.cursor).length) {
    const square = landing(legal, focus.cursor, layout, board) ?? focus.cursor;
    return {
      focus: { cursor: square as Square, selected: focus.cursor },
      action: { type: 'none' },
    };
  }
  return { focus, action: { type: 'none' } };
}

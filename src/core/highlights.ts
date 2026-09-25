// Which of the mover's pieces can move now, and which only after another move.
//
// Both come from the engine's legal lists and nothing else, so they already obey
// the rule that a turn uses as many dice as it can. A pawn whose only use is to
// open the way for another die can move; a piece the dice name that no complete
// turn can use cannot. The board draws the two sets; see #68.

import { pieceAt } from './board.ts';
import { legalAfter, viewGame, type Game } from './game.ts';

// The squares legal actions start from, sorted so that equal sets compare equal.
export function movableSquares(legal: readonly string[]): string[] {
  return [...new Set(legal.map((move) => move.slice(0, 2)))].sort();
}

export type Highlights = {
  // Squares of pieces that can move now.
  now: string[];
  // Squares of pieces that cannot move now but can after one more action.
  later: string[];
};

export function highlights(game: Game): Highlights {
  if (game.phase !== 'move') return { now: [], later: [] };
  const { dfen, side, legal } = viewGame(game);
  const now = movableSquares(legal);
  const board = dfen.split(' ')[0];
  const own = (square: string) => {
    const piece = pieceAt(board, square);
    return piece !== null && (piece === piece.toUpperCase()) === (side === 'w');
  };
  // Play each legal action and read the next list. A piece that has just moved
  // lists its new square, which holds none of the mover's pieces yet, so only
  // pieces still standing where they are now can be marked.
  const later = new Set<string>();
  for (const move of legal)
    for (const square of movableSquares(legalAfter(dfen, move)))
      if (own(square) && !now.includes(square)) later.add(square);
  return { now, later: [...later].sort() };
}

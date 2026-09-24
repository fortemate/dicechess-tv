// What each square should show, derived from inputs a renderer already has.
//
// The board presentation stays independent of the rules engine: a position, a
// cursor, a selection, the legal actions and the last move go in; a grid of
// square descriptions comes out. Nothing here decides legality, and nothing
// here knows how a square is drawn.

import { pieceAt, type Square } from './board.ts';

export type SquareView = {
  square: Square;
  // FEN piece letter, uppercase for White and lowercase for Black, or null.
  piece: string | null;
  dark: boolean;
  cursor: boolean;
  selected: boolean;
  // A legal destination for the currently selected piece.
  destination: boolean;
  // Either end of the last action played.
  lastMove: boolean;
};

export type BoardInput = {
  // The board field of a DFEN, not the whole string.
  board: string;
  cursor?: string | null;
  selected?: string | null;
  // Legal actions in UCI, as the engine reports them.
  legal?: readonly string[];
  lastMove?: string | null;
  // Drawn from Black's side: rank 1 at the top and file h on the left, for a
  // person playing Black against the bot. Hotseat never flips the board.
  flipped?: boolean;
};

const FILES = 'abcdefgh';

// In render order: rank 8 first and file a first with White at the bottom, or
// the reverse of both when the board is flipped.
export function boardView(input: BoardInput): SquareView[][] {
  const { board, cursor = null, selected = null, lastMove = null } = input;
  const destinations = new Set(
    selected
      ? (input.legal ?? [])
          .filter((move) => move.slice(0, 2) === selected)
          .map((move) => move.slice(2, 4))
      : [],
  );
  const touched = lastMove ? [lastMove.slice(0, 2), lastMove.slice(2, 4)] : [];
  const rows: SquareView[][] = [];
  for (let rank = 8; rank >= 1; rank--) {
    const row: SquareView[] = [];
    for (let file = 0; file < 8; file++) {
      const square = (FILES[file] + rank) as Square;
      row.push({
        square,
        piece: pieceAt(board, square),
        dark: (file + rank - 1) % 2 === 0,
        cursor: square === cursor,
        selected: square === selected,
        destination: destinations.has(square),
        lastMove: touched.includes(square),
      });
    }
    rows.push(row);
  }
  return input.flipped ? rows.reverse().map((row) => row.reverse()) : rows;
}

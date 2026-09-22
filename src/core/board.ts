// Board geometry for the canonical FEN board field, independent of any renderer.
// Core code reads positions through this module instead of importing a board
// library's FEN parser, so the same controller serves the Chessground web probe
// and a native board that has no DOM.

export type File = 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g' | 'h';
export type Rank = '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8';
export type Square = `${File}${Rank}`;

const SQUARE = /^[a-h][1-8]$/;

// Returns the FEN piece letter on a square, uppercase for White and lowercase
// for Black, or null when the square is empty or either argument is malformed.
export function pieceAt(board: string, square: string): string | null {
  if (!SQUARE.test(square)) return null;
  const ranks = board.split('/');
  if (ranks.length !== 8) return null;
  const file = square.charCodeAt(0) - 97;
  let index = 0;
  for (const char of ranks[8 - Number(square[1])]) {
    if (index > file) return null;
    const empty = Number(char);
    if (empty >= 1 && empty <= 8) {
      index += empty;
      continue;
    }
    if (index === file) return char;
    index += 1;
  }
  return null;
}

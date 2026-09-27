// What moved between two positions, so that a renderer can slide it (#131).
//
// The board is drawn from the position alone, and its pieces have no identity:
// a move shows up only as squares that changed. This module pairs them back
// into the pieces that travelled, the piece that was taken, and a pawn that was
// promoted. It answers for one action at a time: a move, a capture, castling,
// en passant or a promotion. The action must be the one the game reports as
// its last move, so a new game, a rematch or a resumed game, which change many
// squares and report no last move, give null and are simply redrawn.

import { fileOf, pieceAt, rankOf, squareAt } from './board.ts';

export type Slide = {
  from: string;
  to: string;
  // The piece as it stood before the move: a promoted pawn slides as a pawn and
  // becomes its new piece when it lands.
  piece: string;
};

export type MovePlan = {
  // One slide, or two for castling: the king's first, then the rook's.
  slides: Slide[];
  // The piece taken, on the square it stood on, shown until the mover lands:
  // the destination for a capture, the square behind it for en passant.
  taken: { square: string; piece: string } | null;
};

type Placed = { square: string; piece: string };

const SQUARES = Array.from({ length: 64 }, (_, index) =>
  squareAt(index % 8, Math.floor(index / 8)),
);

const isWhite = (piece: string): boolean => piece === piece.toUpperCase();
const kind = (piece: string): string => piece.toLowerCase();
const distance = (a: string, b: string): number =>
  Math.abs(fileOf(a) - fileOf(b)) + Math.abs(rankOf(a) - rankOf(b));

// Where the piece on `target` came from: the same piece, nearest first, or for
// a promotion a pawn of the same colour.
const sourceOf = (target: Placed, left: Placed[]): Placed | undefined =>
  left
    .filter((source) => source.piece === target.piece)
    .sort(
      (a, b) =>
        distance(a.square, target.square) - distance(b.square, target.square),
    )[0] ??
  (kind(target.piece) === 'p'
    ? undefined
    : left.find(
        (source) =>
          kind(source.piece) === 'p' &&
          isWhite(source.piece) === isWhite(target.piece),
      ));

// Castling moves the king two files along its rank and the rook onto the square
// the king crossed. Two pieces of one side moving any other way are not one
// action.
const isCastling = ([king, rook]: Slide[]): boolean =>
  kind(king.piece) === 'k' &&
  kind(rook.piece) === 'r' &&
  isWhite(king.piece) === isWhite(rook.piece) &&
  rankOf(king.from) === rankOf(king.to) &&
  Math.abs(fileOf(king.to) - fileOf(king.from)) === 2 &&
  rook.to ===
    squareAt((fileOf(king.from) + fileOf(king.to)) / 2, rankOf(king.from));

export function movePlan(
  before: string,
  after: string,
  lastMove: string | null,
): MovePlan | null {
  if (before === after || !lastMove) return null;
  const left: Placed[] = [];
  const arrived: Placed[] = [];
  for (const square of SQUARES) {
    const was = pieceAt(before, square);
    const is = pieceAt(after, square);
    if (was === is) continue;
    if (was) left.push({ square, piece: was });
    if (is) arrived.push({ square, piece: is });
  }
  if (arrived.length === 0 || arrived.length > 2) return null;

  const slides: Slide[] = [];
  for (const target of arrived) {
    const source = sourceOf(target, left);
    if (!source) return null;
    left.splice(left.indexOf(source), 1);
    slides.push({
      from: source.square,
      to: target.square,
      piece: source.piece,
    });
  }
  if (slides.length === 2) {
    slides.sort((a, b) =>
      kind(a.piece) === 'k' ? -1 : kind(b.piece) === 'k' ? 1 : 0,
    );
    if (!isCastling(slides)) return null;
  }

  // The action must be the last move the game reports.
  const [from, to] = [lastMove.slice(0, 2), lastMove.slice(2, 4)];
  if (slides[0].from !== from || slides[0].to !== to) return null;

  // Whatever else left the board was taken: at most one piece, of the other side.
  if (left.length > 1) return null;
  const taken = left[0] ?? null;
  if (taken && isWhite(taken.piece) === isWhite(slides[0].piece)) return null;
  return { slides, taken };
}

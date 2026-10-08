// Where the arrow from the picked-up piece to the cursor goes (#121), in the
// board's pixels. It is apart from ./MoveArrow.tsx, which draws it, because the
// bench swaps that component for its own and the board needs this either way.

export type Point = { x: number; y: number };

// Where the arrow starts and stops, in squares from the centres it joins: it
// leaves the picked-up square at its edge and stops short of the cursor's
// centre, so the destination's dot stays in sight.
const START = 0.5;
const SHORT = 0.22;
const HEAD_LENGTH = 0.42;
const HEAD_WIDTH = 0.42;
const SHAFT_WIDTH = 0.16;

const round = (value: number) => Math.round(value * 10) / 10;

// The arrow's outline as an SVG path, in the board's pixels. A move to the next
// square leaves no room for a shaft, so the arrow is its head alone; one
// shorter still, which no move is, draws nothing.
export function arrowPath(from: Point, to: Point, edge: number): string | null {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  const start = edge * START;
  const tip = length - edge * SHORT;
  if (tip <= start) return null;
  const head = Math.min(edge * HEAD_LENGTH, tip - start);
  const half = (edge * HEAD_WIDTH) / 2;
  const shaft = (edge * SHAFT_WIDTH) / 2;
  // Along the arrow, and across it.
  const ux = dx / length;
  const uy = dy / length;
  const at = (along: number, across: number) =>
    `${round(from.x + ux * along - uy * across)} ${round(from.y + uy * along + ux * across)}`;
  const points = [
    at(start, -shaft),
    at(tip - head, -shaft),
    at(tip - head, -half),
    at(tip, 0),
    at(tip - head, half),
    at(tip - head, shaft),
    at(start, shaft),
  ];
  return `M ${points.join(' L ')} Z`;
}

// Whether the arrow from one centre to another passes over a square's centre,
// between the two: a rook's, a bishop's or a queen's arrow over the squares it
// slides across, a pawn's over its single step, a king's over its castling path.
export function hides(from: Point, to: Point, point: Point, edge: number) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const along =
    ((point.x - from.x) * dx + (point.y - from.y) * dy) / (dx * dx + dy * dy);
  if (along <= 0 || along >= 1) return false;
  const x = from.x + dx * along;
  const y = from.y + dy * along;
  return Math.hypot(point.x - x, point.y - y) < edge * 0.3;
}

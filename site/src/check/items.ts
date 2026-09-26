// The colour-vision check (#108): what each board picture shows, and how an
// answer is scored.
//
// The pictures are Release builds on the Vega Virtual Device, one game played
// on through three builds that differ only in the mark on the pieces that can
// move (#105): A, the green fill; B, the fill with corner brackets; C, the
// corner brackets alone. Squares are numbered in screen order, 0 to 63, from
// the top-left square (a8) along each row: every picture is from a hotseat
// game, drawn with White at the bottom.

export const VARIANTS = ['A', 'B', 'C'] as const;
export type Variant = (typeof VARIANTS)[number];

export type Item = {
  id: string;
  variant: Variant;
  // The squares marked as able to move, as read from the picture.
  movable: readonly number[];
  // Both squares of the last move, tinted.
  lastMove: readonly number[];
  // The cursor of the remote always frames one of the pieces that can move, so
  // that square is found by its frame, not by the mark, and is left out of
  // the score.
  cursor: number;
};

// Two pictures per variant: one with several marks, one with a single mark
// besides the cursor. Each has marks on both square colours and a last move
// tinted on one light and one dark square.
export const ITEMS: readonly Item[] = [
  {
    id: 'a-many',
    variant: 'A',
    movable: [10, 12, 14, 15, 19, 21],
    lastMove: [45, 46],
    cursor: 21,
  },
  {
    id: 'a-few',
    variant: 'A',
    movable: [20, 51],
    lastMove: [27, 28],
    cursor: 20,
  },
  {
    id: 'b-many',
    variant: 'B',
    movable: [46, 51, 57, 60],
    lastMove: [4, 21],
    cursor: 51,
  },
  {
    id: 'b-few',
    variant: 'B',
    movable: [52, 58],
    lastMove: [3, 11],
    cursor: 52,
  },
  {
    id: 'c-many',
    variant: 'C',
    movable: [0, 1, 3, 7, 21],
    lastMove: [2, 8],
    cursor: 1,
  },
  {
    id: 'c-few',
    variant: 'C',
    movable: [0, 7],
    lastMove: [2, 3],
    cursor: 0,
  },
];

export type Counts = {
  // Marked pieces tapped.
  found: number;
  // Marked pieces not tapped.
  missed: number;
  // Taps on a last-move square that carries no mark: the tint taken for the mark.
  lastMove: number;
  // Taps anywhere else.
  other: number;
};

export const squareName = (cell: number) =>
  'abcdefgh'[cell % 8] + String(8 - Math.floor(cell / 8));

export const isLight = (cell: number) =>
  (Math.floor(cell / 8) + (cell % 8)) % 2 === 0;

export function scoreItem(item: Item, taps: readonly number[]): Counts {
  const tapped = new Set(taps.filter((cell) => cell !== item.cursor));
  const marked = item.movable.filter((cell) => cell !== item.cursor);
  const found = marked.filter((cell) => tapped.has(cell)).length;
  let lastMove = 0;
  let other = 0;
  for (const cell of tapped) {
    if (item.movable.includes(cell)) continue;
    if (item.lastMove.includes(cell)) lastMove++;
    else other++;
  }
  return { found, missed: marked.length - found, lastMove, other };
}

const zero = (): Counts => ({ found: 0, missed: 0, lastMove: 0, other: 0 });

// Totals per variant over the pictures answered. Taps for an unknown picture
// are ignored.
export function scoreAnswers(
  taps: Readonly<Record<string, readonly number[]>>,
): Record<Variant, Counts> {
  const totals: Record<Variant, Counts> = { A: zero(), B: zero(), C: zero() };
  for (const item of ITEMS) {
    const answer = taps[item.id];
    if (!answer) continue;
    const counts = scoreItem(item, answer);
    const total = totals[item.variant];
    total.found += counts.found;
    total.missed += counts.missed;
    total.lastMove += counts.lastMove;
    total.other += counts.other;
  }
  return totals;
}

// The questions asked after the pictures, with the values the spreadsheet
// accepts (site/answers-sheet/Code.js checks the same lists).
export const VISION = [
  ['none', 'No'],
  ['red-green', 'Yes, red-green'],
  ['blue-yellow', 'Yes, blue-yellow'],
  ['yes-unknown', "Yes, but I don't know which type"],
  ['not-sure', "I'm not sure"],
] as const;

export const SCREEN = [
  ['phone', 'Phone'],
  ['tablet', 'Tablet'],
  ['computer', 'Computer'],
  ['tv', 'Television'],
] as const;

export type CheckAnswers = {
  v: 1;
  vision: string;
  screen: string;
  // Picture ids in the order they were shown.
  order: string[];
  // The squares tapped on each picture.
  taps: Record<string, number[]>;
};

// The fallback when sending is not possible: the answers as a code the visitor
// copies, which site/scripts/check-results.mjs reads back.
export const encodeAnswers = (answers: CheckAnswers) =>
  btoa(JSON.stringify(answers));

export function decodeAnswers(code: string): CheckAnswers {
  const answers = JSON.parse(atob(code.trim())) as CheckAnswers;
  if (answers?.v !== 1 || typeof answers.taps !== 'object') {
    throw new Error('Not an answer code of the colour check');
  }
  return answers;
}

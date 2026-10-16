// How the board's marks are drawn on the bench, and the colour-vision filter
// laid over the whole screen. Each mark varies on its own, and the whole choice
// lives in the page's address, so a link hands a tester one exact variant.
//
// The first option of every mark, with the "tv" palette, is what the
// television draws today; ./Square.tsx then draws the board with
// native/src/Square.tsx itself, not with a copy.
import { RULE, jump, type Direction } from '../../src/core/cursor.ts';

export const MARKS = {
  // A piece that can move now (#68). fill, fill-corners and corners are the A,
  // B and C of the colour-vision check (#105, #108).
  movable: [
    'fill',
    'fill-corners',
    'corners',
    'outline',
    'pedestal',
    'badge',
    'none',
  ],
  // The picked-up piece. The TV tints it and doubles the cursor's frame
  // (tint-frame). raised, warm-frame, warm-pedestal and lift leave the
  // cursor's perimeter frame to the cursor alone (#401).
  selected: [
    'tint-frame',
    'raised',
    'warm-frame',
    'warm-pedestal',
    'frame',
    'solid',
    'lift',
  ],
  // A legal destination of the picked-up piece: a dot, or a ring on a capture.
  destination: [
    'dot',
    'dot-ringed',
    'dot-large',
    'diamond',
    'fill',
    'corners',
    'outline',
  ],
  // How the legal destination under the cursor is marked in addition to the
  // cursor itself (#401).
  target: ['cursor-only', 'bullseye', 'fill', 'ghost'],
  // The remote's cursor.
  cursor: [
    'frame',
    'two-tone-bold',
    'fill-two-tone',
    'brackets',
    'thick',
    'two-tone',
  ],
  // Both squares of the last action.
  lastMove: ['tint', 'outline', 'none'],
  palette: ['tv', 'okabe-ito', 'high-contrast'],
} as const;

export type MarkName = keyof typeof MARKS;
export type Marks = { [Name in MarkName]: (typeof MARKS)[Name][number] };

// The picked-up marks that share the cursor's perimeter frame. Every other
// picked-up mark leaves the cursor's frame to the cursor alone (#401).
export const SHARES_CURSOR_FRAME: readonly Marks['selected'][] = [
  'tint-frame',
  'frame',
  'solid',
];

export const DEFAULT_MARKS: Marks = {
  movable: 'fill',
  selected: 'tint-frame',
  destination: 'dot',
  target: 'cursor-only',
  cursor: 'frame',
  lastMove: 'tint',
  palette: 'tv',
};

export const isDefault = (marks: Marks): boolean =>
  (Object.keys(DEFAULT_MARKS) as MarkName[]).every(
    (name) => marks[name] === DEFAULT_MARKS[name],
  );

// Colour-vision simulation (./Cvd.tsx). Severity 1: the full deficiency.
export const CVD = [
  'none',
  'protanopia',
  'deuteranopia',
  'tritanopia',
  'achromatopsia',
] as const;
export type Cvd = (typeof CVD)[number];

// Whether the stage plays the live game or shows Step 1 (choosing a piece) and
// Step 2 (choosing a destination) side by side (#401).
export const VIEWS = ['game', 'compare'] as const;
export type BenchView = (typeof VIEWS)[number];

export type Bench = {
  marks: Marks;
  cvd: Cvd;
  view: BenchView;
  // Whether the bench's own controls are shown. A tester handed a fixed
  // variant sees only the game.
  controls: boolean;
};

// Short names in the address, so a link stays readable.
const PARAM: Record<MarkName, string> = {
  movable: 'movable',
  selected: 'selected',
  destination: 'dest',
  target: 'target',
  cursor: 'cursor',
  lastMove: 'last',
  palette: 'palette',
};

const pick = <T extends string>(
  options: readonly T[],
  value: string | null,
  fallback: T,
): T => (options.includes(value as T) ? (value as T) : fallback);

export function parseBench(search: string): Bench {
  const params = new URLSearchParams(search);
  const marks = { ...DEFAULT_MARKS };
  for (const name of Object.keys(MARKS) as MarkName[]) {
    const options: readonly string[] = MARKS[name];
    (marks as Record<MarkName, string>)[name] = pick(
      options,
      params.get(PARAM[name]),
      DEFAULT_MARKS[name],
    );
  }
  return {
    marks,
    cvd: pick(CVD, params.get('cvd'), 'none'),
    view: pick(VIEWS, params.get('view'), 'game'),
    controls: params.get('ui') !== '0',
  };
}

// Only what differs from the default is written, so the TV's own look is the
// bare address.
export function formatBench(bench: Bench): string {
  const params = new URLSearchParams();
  for (const name of Object.keys(MARKS) as MarkName[])
    if (bench.marks[name] !== DEFAULT_MARKS[name])
      params.set(PARAM[name], bench.marks[name]);
  if (bench.cvd !== 'none') params.set('cvd', bench.cvd);
  if (bench.view !== 'game') params.set('view', bench.view);
  if (!bench.controls) params.set('ui', '0');
  const query = params.toString();
  return query ? `?${query}` : '';
}

// Named starting points for the controls, including the candidate styles for
// an in-game Board highlights setting (#401).
export const PRESETS: Readonly<Record<string, Partial<Marks>>> = {
  // The television's marks, which are also variant A of the check.
  'TV today (check A)': {},
  'Standard (enhanced)': {
    movable: 'fill-corners',
    selected: 'raised',
    destination: 'dot-ringed',
    target: 'bullseye',
    cursor: 'two-tone-bold',
  },
  'Focus fill': {
    movable: 'corners',
    selected: 'warm-pedestal',
    destination: 'dot-ringed',
    target: 'fill',
    cursor: 'fill-two-tone',
  },
  'Colour-blind (Okabe-Ito)': {
    movable: 'fill-corners',
    selected: 'warm-pedestal',
    destination: 'dot-ringed',
    target: 'ghost',
    cursor: 'two-tone-bold',
    lastMove: 'outline',
    palette: 'okabe-ito',
  },
  'High contrast': {
    movable: 'corners',
    selected: 'raised',
    destination: 'dot-ringed',
    target: 'ghost',
    cursor: 'fill-two-tone',
    lastMove: 'outline',
    palette: 'high-contrast',
  },
  'Check B: fill + corners': { movable: 'fill-corners' },
  'Check C: corners': { movable: 'corners' },
  'Shapes, high contrast': {
    movable: 'corners',
    selected: 'lift',
    destination: 'dot-large',
    cursor: 'two-tone',
    lastMove: 'outline',
    palette: 'high-contrast',
  },
  'Okabe-Ito colours': { palette: 'okabe-ito' },
};

// The preset the marks are, if they are one.
export const presetOf = (marks: Marks): string | undefined =>
  Object.keys(PRESETS).find((name) =>
    (Object.keys(MARKS) as MarkName[]).every(
      (mark) => (PRESETS[name][mark] ?? DEFAULT_MARKS[mark]) === marks[mark],
    ),
  );

const nextOf = <T>(options: readonly T[], value: T): T =>
  options[(options.indexOf(value) + 1) % options.length];

// Advances the bench state for the B (view), C (vision) or V (preset) key, or
// returns null when the key is not a bench shortcut.
export function stepShortcut(current: Bench, key: string): Bench | null {
  if (key === 'b' || key === 'B') {
    return { ...current, view: nextOf(VIEWS, current.view) };
  }
  if (key === 'c' || key === 'C') {
    return { ...current, cvd: nextOf(CVD, current.cvd) };
  }
  if (key === 'v' || key === 'V') {
    const names = Object.keys(PRESETS);
    const now = names.indexOf(presetOf(current.marks) ?? '');
    const marks = PRESETS[names[(now + 1) % names.length]];
    return { ...current, marks: { ...DEFAULT_MARKS, ...marks } };
  }
  return null;
}

// Scotch position for the side-by-side comparison (#401):
// - Last move b8c6 covers one dark square (b8) and one light square (c6).
// - Step 1 has 10 movable pieces across light and dark squares.
// - Step 2 picks up the Queen on d4 (dark square), whose legal destinations
//   include captures on both light (d5) and dark (e5, a7) squares as well as
//   empty squares of both colours (c4, a4, d3, d2 light; b4, c5, b6, e3, d1 dark).
export const COMPARE_BOARD =
  'r1bqkbnr/ppp2ppp/2n5/3pp3/3QP3/2N2N2/PPP2PPP/R1B1KB1R';
export const COMPARE_LAST_MOVE = 'b8c6';
export const COMPARE_MOVABLE: readonly string[] = [
  'a2',
  'b2',
  'c2',
  'f2',
  'g2',
  'h2',
  'e4',
  'c3',
  'f3',
  'd4',
];
export const COMPARE_SELECTED = 'd4';
export const COMPARE_LEGAL = [
  'd4d5',
  'd4e5',
  'd4a7',
  'd4c4',
  'd4b4',
  'd4a4',
  'd4c5',
  'd4b6',
  'd4e3',
  'd4d3',
  'd4d2',
  'd4d1',
] as const;
export const COMPARE_DESTINATIONS: readonly string[] = COMPARE_LEGAL.map(
  (move) => move.slice(2, 4),
);

export type CompareCursors = { step1: string; step2: string };

export const INITIAL_COMPARE_CURSORS: CompareCursors = {
  step1: 'c3',
  step2: 'd5',
};

export const stepCompareCursors = (
  cursors: CompareCursors,
  direction: Direction,
): CompareCursors => ({
  step1:
    jump(cursors.step1, COMPARE_MOVABLE, direction, {
      rule: RULE,
      wrap: true,
    }) ?? cursors.step1,
  step2:
    jump(cursors.step2, COMPARE_DESTINATIONS, direction, {
      rule: RULE,
      wrap: true,
    }) ?? cursors.step2,
});

export type Palette = {
  movable: string;
  movableLine: string;
  selected: string;
  selectedSolid: string;
  selectedWarm: string;
  selectedWarmFill: string;
  shadow: string;
  destination: string;
  destinationLine: string;
  destinationRing: string;
  cursor: string;
  cursorInner: string;
  cursorFill: string;
  lastMove: string;
  lastMoveLine: string;
};

export const PALETTES: Readonly<Record<Marks['palette'], Palette>> = {
  // native/src/theme.ts, and the corner green of the #105 mock-ups.
  tv: {
    movable: 'rgba(34, 197, 94, 0.5)',
    movableLine: '#14532d',
    selected: 'rgba(0, 234, 255, 0.28)',
    selectedSolid: 'rgba(0, 234, 255, 0.55)',
    selectedWarm: '#f59e0b',
    selectedWarmFill: 'rgba(245, 158, 11, 0.34)',
    shadow: 'rgba(11, 26, 36, 0.58)',
    destination: 'rgba(20, 85, 30, 0.5)',
    destinationLine: '#14532d',
    destinationRing: '#f8fafc',
    cursor: '#00eaff',
    cursorInner: '#0b1a24',
    cursorFill: 'rgba(0, 234, 255, 0.38)',
    lastMove: 'rgba(155, 199, 0, 0.41)',
    lastMoveLine: '#6f8f00',
  },
  // Okabe and Ito's palette, chosen to stay apart under every common colour
  // deficiency: blue for what can move, vermillion for where it can go,
  // reddish-purple for the picked-up piece, yellow for the cursor, and sky
  // blue for the last move.
  'okabe-ito': {
    movable: 'rgba(0, 114, 178, 0.5)',
    movableLine: '#0072b2',
    selected: 'rgba(240, 228, 66, 0.4)',
    selectedSolid: 'rgba(240, 228, 66, 0.7)',
    selectedWarm: '#cc79a7',
    selectedWarmFill: 'rgba(204, 121, 167, 0.38)',
    shadow: 'rgba(0, 0, 0, 0.62)',
    destination: 'rgba(213, 94, 0, 0.7)',
    destinationLine: '#d55e00',
    destinationRing: '#ffffff',
    cursor: '#f0e442',
    cursorInner: '#000000',
    cursorFill: 'rgba(240, 228, 66, 0.44)',
    lastMove: 'rgba(86, 180, 233, 0.45)',
    lastMoveLine: '#56b4e9',
  },
  // No hue at all: black and white only, so every mark must stand on its shape
  // and its lightness.
  'high-contrast': {
    movable: 'rgba(255, 255, 255, 0.45)',
    movableLine: '#000000',
    selected: 'rgba(255, 255, 255, 0.35)',
    selectedSolid: 'rgba(255, 255, 255, 0.65)',
    selectedWarm: '#000000',
    selectedWarmFill: 'rgba(255, 255, 255, 0.42)',
    shadow: 'rgba(0, 0, 0, 0.68)',
    destination: 'rgba(0, 0, 0, 0.55)',
    destinationLine: '#000000',
    destinationRing: '#ffffff',
    cursor: '#ffffff',
    cursorInner: '#000000',
    cursorFill: 'rgba(255, 255, 255, 0.48)',
    lastMove: 'rgba(0, 0, 0, 0.18)',
    lastMoveLine: '#ffffff',
  },
};

// The bench's state, shared by the controls and every square.
let bench: Bench = {
  marks: DEFAULT_MARKS,
  cvd: 'none',
  view: 'game',
  controls: true,
};
const listeners = new Set<() => void>();

export const getBench = (): Bench => bench;

export function setBench(next: Bench): void {
  bench = next;
  for (const listener of [...listeners]) listener();
}

export function subscribeBench(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// How the board's marks are drawn on the bench, and the colour-vision filter
// laid over the whole screen. Each mark varies on its own, and the whole choice
// lives in the page's address, so a link hands a tester one exact variant.
//
// The first option of every mark, with the "tv" palette, is what the
// television draws today; ./Square.tsx then draws the board with
// native/src/Square.tsx itself, not with a copy.

export const MARKS = {
  // A piece that can move now (#68). fill, fill-corners and corners are the A,
  // B and C of the colour-vision check (#105, #108).
  movable: ['fill', 'fill-corners', 'corners', 'outline', 'badge', 'none'],
  // The picked-up piece. The TV tints it and doubles the cursor's frame.
  selected: ['tint-frame', 'frame', 'solid', 'lift'],
  // A legal destination of the picked-up piece: a dot, or a ring on a capture.
  destination: ['dot', 'dot-large', 'fill', 'corners', 'outline'],
  // The remote's cursor.
  cursor: ['frame', 'thick', 'two-tone'],
  // Both squares of the last action.
  lastMove: ['tint', 'outline', 'none'],
  palette: ['tv', 'okabe-ito', 'high-contrast'],
} as const;

export type MarkName = keyof typeof MARKS;
export type Marks = { [Name in MarkName]: (typeof MARKS)[Name][number] };

export const DEFAULT_MARKS: Marks = {
  movable: 'fill',
  selected: 'tint-frame',
  destination: 'dot',
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

export type Bench = {
  marks: Marks;
  cvd: Cvd;
  // Whether the bench's own controls are shown. A tester handed a fixed
  // variant sees only the game.
  controls: boolean;
};

// Short names in the address, so a link stays readable.
const PARAM: Record<MarkName, string> = {
  movable: 'movable',
  selected: 'selected',
  destination: 'dest',
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
  if (!bench.controls) params.set('ui', '0');
  const query = params.toString();
  return query ? `?${query}` : '';
}

// Named starting points for the controls.
export const PRESETS: Readonly<Record<string, Partial<Marks>>> = {
  // The television's marks, which are also variant A of the check.
  'TV today (check A)': {},
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

export type Palette = {
  movable: string;
  movableLine: string;
  selected: string;
  selectedSolid: string;
  destination: string;
  destinationLine: string;
  cursor: string;
  cursorInner: string;
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
    destination: 'rgba(20, 85, 30, 0.5)',
    destinationLine: '#14532d',
    cursor: '#00eaff',
    cursorInner: '#0b1a24',
    lastMove: 'rgba(155, 199, 0, 0.41)',
    lastMoveLine: '#6f8f00',
  },
  // Okabe and Ito's palette, chosen to stay apart under every common colour
  // deficiency: blue for what can move, vermillion for where it can go, sky
  // blue for the last move.
  'okabe-ito': {
    movable: 'rgba(0, 114, 178, 0.5)',
    movableLine: '#0072b2',
    selected: 'rgba(240, 228, 66, 0.4)',
    selectedSolid: 'rgba(240, 228, 66, 0.7)',
    destination: 'rgba(213, 94, 0, 0.7)',
    destinationLine: '#d55e00',
    cursor: '#f0e442',
    cursorInner: '#000000',
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
    destination: 'rgba(0, 0, 0, 0.55)',
    destinationLine: '#000000',
    cursor: '#ffffff',
    cursorInner: '#000000',
    lastMove: 'rgba(0, 0, 0, 0.18)',
    lastMoveLine: '#ffffff',
  },
};

// The bench's state, shared by the controls and every square.
let bench: Bench = { marks: DEFAULT_MARKS, cvd: 'none', controls: true };
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

// How wide a line of text is drawn, near enough to tell whether it fits a line
// of the side panel (#240). No test renderer lays text out, so this adds up
// advance widths instead: Vega's system font has about those of Helvetica and
// Arial, given here in thousandths of an em.
//
// Checked against 28 lines captured on the Vega Virtual Device on 2026-10-06,
// from 20 to 38 dp, the sum came within -6.5% and +4.5% of the width drawn: W
// draws wider than this, R and g narrower. native/test/hints.test.tsx keeps to
// the margin that leaves.
const WIDTHS: Readonly<Record<string, number>> = {
  ' ': 278,
  '!': 278,
  "'": 191,
  ',': 278,
  '-': 333,
  '.': 278,
  ':': 278,
  '?': 556,
  '·': 278,
  '—': 1000,
  '…': 1000,
  '’': 222,
  A: 667,
  B: 667,
  C: 722,
  D: 722,
  E: 667,
  F: 611,
  G: 778,
  H: 722,
  I: 278,
  J: 500,
  K: 667,
  L: 556,
  M: 833,
  N: 722,
  O: 778,
  P: 667,
  Q: 778,
  R: 722,
  S: 667,
  T: 611,
  U: 722,
  V: 667,
  W: 944,
  X: 667,
  Y: 667,
  Z: 611,
  a: 556,
  b: 556,
  c: 500,
  d: 556,
  e: 556,
  f: 278,
  g: 556,
  h: 556,
  i: 222,
  j: 222,
  k: 500,
  l: 222,
  m: 833,
  n: 556,
  o: 556,
  p: 556,
  q: 556,
  r: 333,
  s: 500,
  t: 278,
  u: 556,
  v: 500,
  w: 722,
  x: 500,
  y: 500,
  z: 500,
  ...Object.fromEntries([...'0123456789'].map((digit) => [digit, 556])),
};

// The width of a line of text at a font size, in dp. A character without a
// width here fails rather than counting as nothing.
export const textWidth = (text: string, fontSize: number): number =>
  ([...text].reduce((sum, character) => {
    const width = WIDTHS[character];
    if (width === undefined)
      throw new Error(`no width for ${JSON.stringify(character)} in ${text}`);
    return sum + width;
  }, 0) *
    fontSize) /
  1000;

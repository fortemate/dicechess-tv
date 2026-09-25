// Where things may go on a television screen.
//
// Amazon's Fire TV guidelines keep every piece of UI out of the outer 5% of each
// edge, which a television may crop (#51): 48 dp across and 27 dp down on the
// 960 x 540 dp screen Vega reports.
export const SAFE_EDGE = 0.05;

export const safeInsets = (width: number, height: number) => ({
  x: Math.ceil(width * SAFE_EDGE),
  y: Math.ceil(height * SAFE_EDGE),
});

// The board beside a side panel, as the game and the tutorial draw it. The board
// keeps 40 dp above and below and 32 dp from the panel. At 460 dp that leaves
// the panel 372 dp, enough for the longest headline on one line.
export const BOARD_GAP = 32;
export const boardSide = (width: number, height: number): number =>
  Math.min(height - 80, width * 0.62);

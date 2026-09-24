// Board palette, inherited from the WebView probe so the board kept the look
// people had already reviewed. The square and last-move colours are Chessground's
// brown theme; the probe is gone, and these values are now ours to change.
export const THEME = {
  background: '#122737',
  light: '#f0d9b5',
  dark: '#b58863',
  cursor: '#00eaff',
  // Chessground's move-destination green. Translucent and dark, so a dot reads
  // on both square colours.
  destination: 'rgba(20, 85, 30, 0.5)',
  lastMove: 'rgba(155, 199, 0, 0.41)',
  selected: 'rgba(0, 234, 255, 0.28)',
} as const;

// Board palette, inherited from the WebView probe so the board kept the look
// people had already reviewed. The square and last-move colours are Chessground's
// brown theme; the probe is gone, and these values are now ours to change.
export const THEME = {
  background: '#122737',
  light: '#f0d9b5',
  dark: '#b58863',
  cursor: '#00eaff',
  destination: '#ffd166',
  lastMove: 'rgba(155, 199, 0, 0.41)',
  selected: 'rgba(0, 234, 255, 0.28)',
} as const;

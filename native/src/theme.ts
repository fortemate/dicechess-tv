// Board palette. The cursor and destination colours are the ones the web probe
// already uses in src/style.css, so the two renderers read the same way; the
// square and last-move colours match the Chessground brown theme it ships with.
export const THEME = {
  background: '#122737',
  light: '#f0d9b5',
  dark: '#b58863',
  cursor: '#00eaff',
  destination: '#ffd166',
  lastMove: 'rgba(155, 199, 0, 0.41)',
  selected: 'rgba(0, 234, 255, 0.28)',
} as const;

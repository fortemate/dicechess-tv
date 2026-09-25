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
  // A piece that can move now (#68): translucent, so it reads on both square
  // colours and under the last-move tint.
  movable: 'rgba(34, 197, 94, 0.5)',
  // Dice: ivory faces like the light squares, an unspent die ringed in the
  // cursor's cyan at half strength, and the outline of an empty slot.
  die: '#f4ead8',
  dieRing: 'rgba(0, 234, 255, 0.55)',
  dieSlot: '#aab8c9',
} as const;

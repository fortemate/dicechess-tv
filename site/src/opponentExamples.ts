// These teaching positions are rendered on the profiles and exercised against
// the engine by test/opponent-examples.test.ts. White is the opponent in each.
export const OPPONENT_EXAMPLES = {
  rolly: {
    mode: 'random',
    fen: 'k7/8/8/8/8/8/8/R3K3 w - - 0 1',
    dice: [4, 6, 6],
    turns: [['a1a8']],
    description: 'White rook on a1, White king on e1, Black king on a8.',
    caption: 'Rook, King, King: Rolly takes the king from a1 to a8 at once.',
  },
  grabby: {
    mode: 'greedy',
    fen: 'k7/8/7q/8/8/8/3P4/2B1K3 w - - 0 1',
    dice: [1, 3, 2],
    turns: [
      ['d2d3', 'c1h6'],
      ['d2d4', 'c1h6'],
    ],
    description:
      'White bishop on c1, pawn on d2 and king on e1. Black queen on h6 and king on a8.',
    caption:
      'Pawn, Bishop, Knight: move the pawn, then take the queen with the bishop. No knight can use the last die.',
  },
  rampage: {
    mode: 'aggressive',
    fen: '7k/8/8/8/8/8/8/2N1K3 w - - 0 1',
    dice: [2, 1, 1],
    turns: [['c1d3']],
    description: 'White knight on c1 and king on e1. Black king on h8.',
    caption:
      'Knight, Pawn, Pawn: Rampage moves the knight from c1 to d3, closer to your king. There are no pawns to move.',
  },
} as const;

// The in-game rules guide.
//
// Nine topics, short enough to read from a sofa. The shape — a reference split
// into small named topics rather than one long page — follows what the Chess
// Hero beta does well; the content does not. Their guide describes their game,
// and our own research note is explicit that compatibility with our rules is
// not established. So every factual claim here is written against our engine
// and checked against it in test/rules.test.ts.
//
// The division of labour with the tutorial is deliberate: the tutorial explains
// in the moment of difficulty, this is for reading and remembering. Castling,
// promotion and en passant live here precisely because the tutorial leaves them
// out.
//
// Clocks, doubling, stakes, matchmaking and rating are absent because this game
// has none of them.

export type RulesTopic = {
  id: string;
  title: string;
  // One claim per line. Anything factual is asserted against the engine.
  lines: readonly string[];
};

export const RULES: readonly RulesTopic[] = [
  {
    id: 'winning',
    title: 'How a game ends',
    lines: [
      'Capture the enemy king and you win immediately.',
      'There is no checkmate. The king is taken like any other piece.',
      'A player may resign, and in hotseat both players may agree a draw.',
      'A turn that ends 100 half-moves after the last capture or pawn move draws.',
    ],
  },
  {
    id: 'turn',
    title: 'Your turn',
    lines: [
      'Roll three dice, then play up to three actions with them.',
      'Each action spends one die.',
      'The turn ends when no die you hold can be used.',
      'Moving one piece out of the way to free another is normal play.',
    ],
  },
  {
    id: 'dice',
    title: 'What the dice mean',
    lines: [
      'Each die names a piece: pawn, knight, bishop, rook, queen, king.',
      'You may only move a piece one of your dice names.',
      'The same piece type can come up more than once, and then you may move it again.',
      'A die with no legal move is simply lost.',
    ],
  },
  {
    id: 'maximum',
    title: 'Use as many dice as you can',
    lines: [
      'You must play as many of your three actions as the position allows.',
      'You cannot stop early to keep a piece where it is.',
      'You cannot choose an order that wastes a die when another order would not.',
      'If no die can be used at all, the turn passes.',
    ],
  },
  {
    id: 'check',
    title: 'No check, no checkmate',
    lines: [
      'A king under attack is not in check, and nothing warns you.',
      'You may leave your king attacked, and you may move into attack.',
      'Checkmate and stalemate do not exist here.',
      'Guarding the king is your judgement, not a rule.',
    ],
  },
  {
    id: 'castling',
    title: 'Castling',
    lines: [
      'Castling needs a king die and a rook die, and spends both.',
      'The king and that rook must not have moved, and the squares between them must be empty.',
      'It counts as one action, not two.',
      'Because there is no check, castling out of or through attack is allowed.',
    ],
  },
  {
    id: 'promotion',
    title: 'Promotion',
    lines: [
      'A pawn reaching the last rank promotes, and spends a pawn die to do it.',
      'Choose a queen, rook, bishop or knight.',
      'Only choices that keep the rest of the turn legal are offered.',
    ],
  },
  {
    id: 'enpassant',
    title: 'En passant',
    lines: [
      'A pawn that has just advanced two squares may be taken in passing.',
      'It needs a pawn die, as any pawn move does.',
      'The chance lasts only for the action immediately after that advance.',
    ],
  },
  {
    id: 'draws',
    title: 'Draws',
    lines: [
      'In hotseat, both players may agree a draw from the menu.',
      'A draw also comes when a turn ends 100 half-moves after the last capture or pawn move.',
      'Stalemate, repetition and insufficient material do not draw here.',
    ],
  },
];

export const topic = (id: string): RulesTopic | undefined =>
  RULES.find((entry) => entry.id === id);

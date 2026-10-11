// What a screen reader is told (#257), checked against what the engine does,
// as the cues are in test/cues.test.ts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  dieLabel,
  gameSpeech,
  sentences,
  squareLabel,
  NO_MOVE_LINE,
} from '../src/core/announcements.ts';
import {
  agreeDraw,
  moveGame,
  newGame,
  nextTurn,
  resignGame,
  rollGame,
  viewGame,
  type Game,
  type Mode,
  type Side,
} from '../src/core/game.ts';

const PAWN = 1;
const KNIGHT = 2;
const ROOK = 4;
const QUEEN = 5;
const KING = 6;

const OPENING = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

const rolled = (
  start: string,
  roll: number[],
  mode: Mode = 'hotseat',
  human?: Side,
) => rollGame(newGame(mode, 'speech', start, human), roll);

// Play one move the engine offers, and hear what is said.
const say = (game: Game, move: string) => {
  assert.ok(viewGame(game).legal.includes(move), `${move} is not legal here`);
  return gameSpeech(game, moveGame(game, move));
};

test('a square says where it is, what stands on it and its mark', () => {
  const square = {
    square: 'e2' as const,
    piece: 'P',
    selected: false,
    destination: false,
    movable: false,
  };
  assert.equal(squareLabel(square), 'e2, white pawn');
  assert.equal(
    squareLabel({ ...square, movable: true }),
    'e2, white pawn, can move',
  );
  assert.equal(
    squareLabel({ ...square, selected: true }),
    'e2, white pawn, picked up',
  );
  assert.equal(
    squareLabel({ ...square, square: 'e4', piece: null, destination: true }),
    'e4, empty, can go here',
  );
  assert.equal(
    squareLabel({ ...square, square: 'd5', piece: 'n', destination: true }),
    'd5, black knight, can take',
  );
});

test('a die says its piece, and whether it is spent or cannot be', () => {
  assert.equal(
    dieLabel({ piece: 'N', spent: false, leftover: false }),
    'knight die',
  );
  assert.equal(
    dieLabel({ piece: 'Q', spent: true, leftover: false }),
    'queen die, used',
  );
  assert.equal(
    dieLabel({ piece: 'K', spent: false, leftover: true }),
    "king die, can't be used",
  );
});

test('a roll says who rolled what, and the dice no turn can spend', () => {
  const before = newGame('hotseat', 'speech');
  // At the start only pawns and knights can move.
  assert.deepEqual(
    gameSpeech(before, rollGame(before, [KNIGHT, KNIGHT, PAWN])),
    ['White rolled knight, knight and pawn'],
  );
  assert.deepEqual(
    gameSpeech(before, rollGame(before, [KNIGHT, QUEEN, KING])),
    ['White rolled knight, queen and king', "The queen and king can't be used"],
  );
});

test('a roll with nothing to play says the turn passes, against the bot by name', () => {
  const mine = newGame('aggressive', 'speech');
  assert.deepEqual(gameSpeech(mine, rollGame(mine, [QUEEN, ROOK, KING])), [
    'You rolled queen, rook and king',
    NO_MOVE_LINE,
  ]);
  const theirs = nextTurn(rollGame(mine, [QUEEN, ROOK, KING]));
  assert.deepEqual(gameSpeech(theirs, rollGame(theirs, [QUEEN, ROOK, KING])), [
    'Rampage rolled queen, rook and king',
    NO_MOVE_LINE,
  ]);
});

test('a move says who moved which piece from where to where', () => {
  assert.deepEqual(say(rolled(OPENING, [KNIGHT, KNIGHT, KNIGHT]), 'b1c3'), [
    'White moved the knight from b1 to c3',
  ]);
  // The bot plays White here, so its move goes by its name.
  assert.deepEqual(
    say(rolled(OPENING, [KNIGHT, KNIGHT, KNIGHT], 'greedy', 'b'), 'g1f3'),
    ['Grabby moved the knight from g1 to f3'],
  );
});

test('a capture says what was taken, en passant included', () => {
  assert.deepEqual(
    say(rolled('4k3/8/8/8/8/8/p7/R3K3 w - - 0 1', [ROOK, ROOK, ROOK]), 'a1a2'),
    ['White moved the rook from a1 to a2 and took the pawn'],
  );
  const passing = rolled('4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1', [
    PAWN,
    PAWN,
    PAWN,
  ]);
  assert.deepEqual(say(passing, 'e5d6'), [
    'White moved the pawn from e5 to d6 and took the pawn',
  ]);
});

test('castling and promotion are said as what they are', () => {
  // Castling spends the king and a rook die, and there is no queen to use the
  // third.
  const castling = rolled('4k3/8/8/8/8/8/8/R3K2R w KQ - 0 1', [
    KING,
    ROOK,
    QUEEN,
  ]);
  assert.deepEqual(say(castling, 'e1g1'), [
    "White castled on the king's side",
    "White's turn is over",
  ]);
  assert.deepEqual(
    say(castling, 'e1c1')[0],
    "White castled on the queen's side",
  );
  assert.deepEqual(
    say(rolled('4k3/P7/8/8/8/8/8/4K3 w - - 0 1', [PAWN, PAWN, PAWN]), 'a7a8q'),
    [
      'White moved the pawn from a7 to a8. The pawn became a queen',
      "White's turn is over",
    ],
  );
});

test('a turn over is said, then whose turn it is when it is handed on', () => {
  // Knight, king, king: after the knight nothing can use the kings.
  const game = rolled(OPENING, [KNIGHT, KING, KING]);
  const over = moveGame(game, 'b1c3');
  assert.deepEqual(gameSpeech(game, over), [
    'White moved the knight from b1 to c3',
    "White's turn is over",
  ]);
  // In a game against a friend, OK hands the turn on and rolls for the next
  // side in one step.
  assert.deepEqual(
    gameSpeech(over, rollGame(nextTurn(over), [PAWN, PAWN, PAWN])),
    ["Black's turn", 'Black rolled pawn, pawn and pawn'],
  );
});

test('against the bot the person is told their turn is over, and when it is theirs again', () => {
  const game = rolled(OPENING, [KNIGHT, KING, KING], 'random');
  const over = moveGame(game, 'b1c3');
  assert.deepEqual(gameSpeech(game, over), [
    'You moved the knight from b1 to c3',
    'Your turn is over',
  ]);
  const theirs = nextTurn(over);
  assert.deepEqual(gameSpeech(over, theirs), ["Rolly's turn"]);
  // The bot's own turn over is not said: it hands on a moment later.
  const done = rollGame(theirs, [KING, KING, KNIGHT]);
  const last = moveGame(done, viewGame(done).legal[0]);
  assert.equal(last.phase, 'handoff');
  assert.equal(gameSpeech(done, last).length, 1);
  assert.deepEqual(gameSpeech(last, nextTurn(last)), ['Your turn']);
});

test('the result says who won and how, in the words on screen', () => {
  const win = rolled(
    'k7/8/8/8/8/8/8/R3K3 w - - 0 1',
    [ROOK, ROOK, ROOK],
    'random',
  );
  assert.deepEqual(say(win, 'a1a8'), [
    'You moved the rook from a1 to a8 and took the king',
    'You win!',
    "You took Rolly's king",
  ]);
  const loss = rolled(
    'K7/8/8/8/8/8/8/r3k3 b - - 0 1',
    [ROOK, ROOK, ROOK],
    'aggressive',
  );
  assert.deepEqual(say(loss, 'a1a8'), [
    'Rampage moved the rook from a1 to a8 and took the king',
    'Rampage wins',
    'Rampage took your king',
  ]);
  const shared = rolled(OPENING, [QUEEN, ROOK, KNIGHT]);
  assert.deepEqual(gameSpeech(shared, resignGame(shared)), [
    'Black wins',
    'White resigned',
  ]);
  assert.deepEqual(gameSpeech(shared, agreeDraw(shared)), [
    'Draw',
    'Both players agreed',
  ]);
});

test('a different game, or no change at all, says nothing', () => {
  const game = rolled(OPENING, [QUEEN, ROOK, KNIGHT]);
  assert.deepEqual(gameSpeech(game, newGame('hotseat', 'another')), []);
  assert.deepEqual(gameSpeech(game, game), []);
});

test('lines are said as sentences', () => {
  assert.equal(
    sentences(['You win!', "You took Rolly's king"]),
    "You win! You took Rolly's king.",
  );
  assert.equal(sentences([NO_MOVE_LINE]), `${NO_MOVE_LINE}.`);
});

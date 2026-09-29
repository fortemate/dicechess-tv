import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DiceChess } from '@fortemate/dicechess-engine';
import { diceOf } from '../src/core/dice.ts';
import {
  moveGame,
  newGame,
  nextTurn,
  rollGame,
  viewGame,
  type Game,
} from '../src/core/game.ts';

// As a screen calls it: with the view it has already computed.
const diceFor = (game: Game) => {
  const view = viewGame(game);
  return diceOf(game.roll, view.remaining, view.playable);
};

const faces = (dice: { piece: string; spent: boolean }[]) =>
  dice
    .map(({ piece, spent }) => (spent ? piece.toLowerCase() : piece))
    .join('');

test('there are no dice before the roll, and three after it', () => {
  const game = newGame('hotseat', 'dice');
  assert.deepEqual(diceFor(game), []);
  // Queen, rook, knight: upper case is unspent.
  assert.equal(faces(diceFor(rollGame(game, [5, 4, 2]))), 'QRN');
});

test('an action spends its die', () => {
  const rolled = rollGame(newGame('hotseat', 'dice'), [5, 4, 2]);
  assert.equal(faces(diceFor(moveGame(rolled, 'b1c3'))), 'QRn');
});

test('a repeated piece is spent from the left', () => {
  const rolled = rollGame(newGame('hotseat', 'dice'), [1, 1, 3]);
  assert.equal(faces(diceFor(moveGame(rolled, 'e2e4'))), 'pPB');
});

test('castling spends the king die and a rook die', () => {
  const rolled = rollGame(
    newGame(
      'hotseat',
      'castle',
      'r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1',
    ),
    [6, 4, 1],
  );
  assert.equal(faces(diceFor(rolled)), 'KRP');
  assert.equal(faces(diceFor(moveGame(rolled, 'e1g1'))), 'krP');
});

test('a turn handed over clears the dice', () => {
  // Rook, rook, rook from the start: nothing can move, so the turn is handed on.
  const stuck = rollGame(newGame('hotseat', 'stuck'), [4, 4, 4]);
  assert.equal(stuck.phase, 'handoff');
  assert.equal(faces(diceFor(stuck)), 'RRR');
  assert.deepEqual(diceFor(nextTurn(stuck)), []);
});

test('once the turn is over, the dice it could not use are leftovers', () => {
  // Rook, rook, rook from the start: all three are left over, none spent.
  const stuck = diceFor(rollGame(newGame('hotseat', 'stuck'), [4, 4, 4]));
  assert.deepEqual(
    stuck.map(({ spent, leftover }) => [spent, leftover]),
    [
      [false, true],
      [false, true],
      [false, true],
    ],
  );
  // Knight, king, king: the knight is spent, and nothing can use the kings.
  const partial = moveGame(
    rollGame(newGame('hotseat', 'partial'), [2, 6, 6]),
    'b1c3',
  );
  assert.equal(partial.phase, 'handoff');
  assert.deepEqual(
    diceFor(partial).map(({ piece, spent, leftover }) => [
      piece,
      spent,
      leftover,
    ]),
    [
      ['N', true, false],
      ['K', false, true],
      ['K', false, true],
    ],
  );
});

// Each die as the screen draws it: upper case while an action can spend it, a
// dot once it is spent, and lower case when no legal turn left can spend it.
const lit = (game: Game) =>
  diceFor(game)
    .map(({ piece, spent, leftover }) =>
      spent ? '.' : leftover ? piece.toLowerCase() : piece,
    )
    .join('');

test('a die no legal turn can spend is a leftover from the roll on', () => {
  const opening = (roll: number[]) =>
    rollGame(newGame('hotseat', 'opening'), roll);
  // Bishop, knight, queen: only a knight can move, and no knight move frees
  // the bishop or the queen.
  assert.equal(lit(opening([3, 2, 5])), 'bNq');
  // Queen, rook, knight: the rook cannot move first, but a1b1 can follow b1a3,
  // so only the queen is lost. It stays lost after the knight.
  const rook = opening([5, 4, 2]);
  assert.equal(lit(rook), 'qRN');
  assert.equal(lit(moveGame(rook, 'b1a3')), 'qR.');
  // Pawn, bishop, queen: a pawn move frees either, and a turn spends all three.
  assert.equal(lit(opening([1, 3, 5])), 'PBQ');
});

test('a die a legal turn can spend stays lit until an action rules it out', () => {
  // A pawn move frees the bishop or the queen, never both: two of the three
  // dice can be played, and which two depends on the pawn.
  const choice = rollGame(
    newGame('hotseat', 'choice', '4k3/8/8/8/8/8/PP2P1P1/QN2KB2 w - - 0 1'),
    [1, 3, 5],
  );
  assert.equal(lit(choice), 'PBQ');
  // e2e3 frees the bishop only, so the queen is lost.
  assert.equal(lit(moveGame(choice, 'e2e3')), '.Bq');
  // b2b3 frees the queen only, so the bishop is lost.
  assert.equal(lit(moveGame(choice, 'b2b3')), '.bQ');
});

test('a king capture ends the turn, and every die left goes with it', () => {
  // Knight, pawn, pawn: c2c3, c3c4 and the knight taking the king on c5 spend
  // all three.
  const capture = rollGame(
    newGame('hotseat', 'capture', '8/8/8/2k5/8/1N6/2P5/K7 w - - 0 1'),
    [2, 1, 1],
  );
  assert.equal(lit(capture), 'NPP');
  // After c2c4 only the capture follows, so the pawn die left is lost.
  assert.equal(lit(moveGame(capture, 'c2c4')), 'N.p');
  // Taking the king at once ends the game with both pawn dice unspent.
  const taken = moveGame(capture, 'b3c5');
  assert.equal(taken.result?.reason, 'king-captured');
  assert.equal(lit(taken), '.pp');
});

test('when one of two equal dice is lost, the right one dims and the left one is spent', () => {
  // Pawn, pawn, king: e6e7 is the only pawn move, as the black king blocks e8,
  // so one pawn die is lost.
  const pawns = rollGame(
    newGame('hotseat', 'pawns', '4k3/8/4P3/8/8/8/8/K7 w - - 0 1'),
    [1, 1, 6],
  );
  assert.equal(lit(pawns), 'PpK');
  assert.equal(lit(moveGame(pawns, 'e6e7')), '.pK');
});

test('the engine is asked only when the tree cannot tell, and once for each point of the turn', (t) => {
  const asked = t.mock.method(DiceChess, 'getPlayableDice');
  // Pawn, pawn, pawn: e2e4, e4e5 and e5e6 spend all three, so the tree is
  // enough at the roll and after each action.
  let pawns = rollGame(newGame('hotseat', 'asked'), [1, 1, 1]);
  for (const move of ['e2e4', 'e4e5', 'e5e6']) {
    assert.equal(viewGame(pawns).playable, viewGame(pawns).remaining);
    pawns = moveGame(pawns, move);
  }
  assert.equal(asked.mock.callCount(), 0);

  // Knight, rook, queen, in an order no other test rolls, so nothing is kept
  // for it yet. The longest turn has two actions for three dice, so the engine
  // is asked at the roll, and again after b1a3, with two dice left and one
  // action to follow. Views of the same point share the answer.
  const rook = rollGame(newGame('hotseat', 'asked'), [2, 4, 5]);
  assert.equal(viewGame(rook).playable, 'NR');
  assert.equal(viewGame(rook).playable, 'NR');
  assert.equal(asked.mock.callCount(), 1);
  const knight = moveGame(rook, 'b1a3');
  assert.equal(viewGame(knight).playable, 'R');
  assert.equal(asked.mock.callCount(), 2);
  // After the rook, the node ends the turn.
  assert.equal(viewGame(moveGame(knight, 'a1b1')).playable, '');
  assert.equal(asked.mock.callCount(), 2);
});

test("Black's unspent dice stay unspent, though the engine writes them in lower case", () => {
  const black = rollGame(
    newGame(
      'hotseat',
      'black-dice',
      'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1',
    ),
    [5, 4, 2],
  );
  // Queen, rook, knight: the knight moves, and the engine keeps `rq`.
  const after = moveGame(black, 'g8f6');
  assert.equal(viewGame(after).dfen.split(' ')[6], 'rq');
  // Listed as rolled and in upper case, so the dice read left to right.
  assert.equal(viewGame(after).remaining, 'QR');
  assert.equal(faces(diceFor(after)), 'QRn');
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RULES, topic } from '../src/core/rules.ts';
import {
  newGame,
  rollGame,
  moveGame,
  nextTurn,
  resignGame,
  agreeDraw,
  viewGame,
} from '../src/core/game.ts';
import { pieceAt } from '../src/core/board.ts';

// A rolled game from a position, so a claim can be checked against the engine
// rather than against the sentence that describes it.
const at = (start: string, roll: number[], id = 'rules') =>
  rollGame(newGame('hotseat', id, start), roll);

// Binds a sentence in the guide to the check below it. Without this the text
// and the engine drift apart silently: the behavior stays right while the
// sentence describing it goes wrong, which is the whole failure this file
// exists to prevent.
const claims = (id: string, line: string) => {
  const entry = topic(id);
  assert.ok(entry, `no topic ${id}`);
  assert.ok(
    entry.lines.includes(line),
    `${id} no longer says "${line}" — re-check it against the engine`,
  );
};

const PAWN = 1;
const KNIGHT = 2;
const BISHOP = 3;
const ROOK = 4;
const QUEEN = 5;
const KING = 6;

test('the guide covers what this game has and nothing it does not', () => {
  assert.deepEqual(
    RULES.map((entry) => entry.id),
    [
      'winning',
      'turn',
      'dice',
      'maximum',
      'check',
      'castling',
      'promotion',
      'enpassant',
      'draws',
    ],
  );
  // Clocks, doubling, stakes and matchmaking belong to a different product.
  const words = RULES.flatMap((entry) => entry.lines)
    .join(' ')
    .toLowerCase();
  for (const absent of [
    'clock',
    'timer',
    'double',
    'stake',
    'coin',
    'rating',
  ]) {
    assert.doesNotMatch(words, new RegExp(absent), absent);
  }
  // Every topic is readable on a screen: a title and a few short lines.
  for (const entry of RULES) {
    assert.ok(entry.lines.length >= 3 && entry.lines.length <= 4, entry.id);
    assert.ok(
      entry.lines.every((line) => line.length <= 95),
      entry.id,
    );
  }
});

test('"capture the king and you win immediately" is what the engine does', () => {
  claims('winning', 'Capture the enemy king and you win immediately.');
  claims('maximum', 'Capturing the king ends the game, even with dice left.');
  claims(
    'winning',
    'There is no checkmate. The king is taken like any other piece.',
  );
  const game = at('k7/8/8/8/8/8/8/R3K3 w - - 0 1', [ROOK, ROOK, ROOK], 'king');
  assert.ok(viewGame(game).legal.includes('a1a8'));
  const taken = moveGame(game, 'a1a8');
  assert.deepEqual(taken.result, { winner: 'w', reason: 'king-captured' });
  assert.equal(taken.phase, 'ended');
  // Immediately: dice are left over and the turn does not continue.
  assert.equal(taken.moves.length, 1);
});

test('"an attack on your king does not force you to defend it" is what the engine does', () => {
  claims('check', 'An attack on your king does not force you to defend it.');
  claims(
    'check',
    'You may leave your king attacked, and you may move into attack.',
  );
  // The black rook on e8 attacks the white king on e1.
  const game = at('4rk2/8/8/8/8/8/8/4K2R w K - 0 1', [ROOK, KING, KING]);
  const state = viewGame(game);
  const board = state.dfen.split(' ')[0];
  assert.equal(pieceAt(board, 'e8'), 'r');
  assert.equal(pieceAt(board, 'e1'), 'K');

  // A rook move that ignores the attack is legal, so the attack forbids nothing.
  const ignoring = state.legal.filter((move) => move.slice(0, 2) === 'h1');
  assert.ok(
    ignoring.length > 0,
    'the rook cannot move while the king is attacked',
  );
  const after = moveGame(game, ignoring[0]);
  assert.equal(pieceAt(viewGame(after).dfen.split(' ')[0], 'e1'), 'K');

  // And the king may step to a square the same rook attacks.
  assert.ok(
    state.legal.includes('e1e2'),
    'the king cannot move into attack, so the claim is wrong',
  );
});

test('"castling needs both dice and spends both" is what the engine does', () => {
  claims(
    'castling',
    'Castling needs a king die and a rook die, and spends both.',
  );
  claims('castling', 'It counts as one action, not two.');
  const game = at('4k3/8/8/8/8/8/8/R3K2R w KQ - 0 1', [KING, ROOK, QUEEN]);
  assert.ok(viewGame(game).legal.includes('e1g1'));
  const castled = moveGame(game, 'e1g1');
  // The king die and a rook die are both gone; the queen die remains.
  assert.equal(viewGame(castled).remaining, 'Q');
  // One action, not two.
  assert.deepEqual(castled.moves, ['e1g1']);
});

test('the maximum is dice used, so castling need not maximize the number of actions', () => {
  claims('maximum', 'You must use as many dice as the position allows.');
  const start = '4k3/8/8/8/8/8/Q7/4K2R w K - 0 1';
  for (const actions of [
    ['e1g1', 'a2a3'],
    ['e1d1', 'h1h2', 'a2a3'],
  ]) {
    let game = at(start, [KING, ROOK, QUEEN]);
    for (const action of actions) game = moveGame(game, action);
    assert.equal(game.phase, 'handoff');
    assert.equal(viewGame(game).remaining, '');
  }
});

test('"only a piece your dice name may move" is what the engine does', () => {
  claims('dice', 'You may only move a piece one of your dice names.');
  // Queen, rook and knight from the opening: only the knights can act.
  const game = at('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', [
    QUEEN,
    ROOK,
    KNIGHT,
  ]);
  const state = viewGame(game);
  const board = state.dfen.split(' ')[0];
  assert.ok(state.legal.length > 0);
  for (const move of state.legal) {
    assert.equal(pieceAt(board, move.slice(0, 2)), 'N', move);
  }
});

test('"the same type twice lets you move it again" is what the engine does', () => {
  claims(
    'dice',
    'The same piece type can come up more than once, and then you may move it again.',
  );
  const game = at('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', [
    KNIGHT,
    KNIGHT,
    KNIGHT,
  ]);
  let played = game;
  for (let i = 0; i < 3; i++) {
    const legal = viewGame(played).legal;
    assert.ok(legal.length > 0, `no knight action left at ${i}`);
    played = moveGame(played, legal[0]);
  }
  assert.equal(played.moves.length, 3);
  assert.equal(viewGame(played).remaining, '');
});

test('"a die no legal sequence can use is lost" and "the turn passes" are what the engine does', () => {
  claims(
    'dice',
    'A die is lost only if no legal sequence of actions can use it.',
  );
  claims('maximum', 'If no die can be used at all, the turn passes.');
  // Three king dice with the king walled in by its own pieces: nothing to play.
  const stuck = at('4k3/8/8/8/8/8/3PPP2/3PKP2 w - - 0 1', [KING, KING, KING]);
  const state = viewGame(stuck);
  assert.equal(state.legal.length, 0);
  assert.equal(stuck.phase, 'handoff');
  // The dice are still held and simply go unused.
  assert.equal(state.remaining, 'KKK');
  assert.equal(viewGame(nextTurn(stuck)).side, 'b');
});

test('a blocked piece can be freed later in the turn, so its die is not lost at the roll', () => {
  claims(
    'maximum',
    'You cannot choose moves or an order that wastes a usable die.',
  );
  let game = at('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', [
    PAWN,
    BISHOP,
    KING,
  ]);
  game = moveGame(game, 'd2d3');
  // Bd2 would block the king and waste its die; Be3 leaves Kd2 available.
  assert.ok(!viewGame(game).legal.includes('c1d2'));
  game = moveGame(game, 'c1e3');
  game = moveGame(game, 'e1d2');
  assert.equal(game.phase, 'handoff');
  assert.equal(viewGame(game).remaining, '');
});

test('"the turn ends when no die can be used" is what the engine does', () => {
  claims('turn', 'The turn ends when no die you hold can be used.');
  claims(
    'turn',
    'A normal move spends one die; castling spends a king die and a rook die.',
  );
  let game = at('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', [
    PAWN,
    PAWN,
    PAWN,
  ]);
  // The phase stays on move while anything remains playable.
  for (let i = 0; i < 3; i++) {
    assert.equal(game.phase, 'move', `turn ended early at ${i}`);
    game = moveGame(game, viewGame(game).legal[0]);
  }
  assert.equal(game.phase, 'handoff');
  assert.equal(viewGame(game).legal.length, 0);
});

test('"promotion offers only choices that keep the turn legal" is what the engine does', () => {
  claims(
    'promotion',
    'Only choices that keep the rest of the turn legal are offered.',
  );
  claims(
    'promotion',
    'A pawn reaching the last rank promotes, and spends a pawn die to do it.',
  );
  const game = at(
    '4k3/P7/8/8/8/8/8/4K3 w - - 0 1',
    [PAWN, PAWN, PAWN],
    'promo',
  );
  const promotions = viewGame(game).legal.filter((move) => move.length === 5);
  assert.ok(promotions.length > 0, 'the pawn cannot promote');
  // Every offered suffix is one the engine itself listed.
  for (const move of promotions) {
    assert.match(move.slice(4), /^[qrbn]$/);
    assert.ok(viewGame(game).legal.includes(move));
  }
  // Promotion spends a pawn die like any pawn move.
  assert.equal(viewGame(moveGame(game, promotions[0])).remaining, 'PP');
});

test('en passant stays available on the second or third action of the next turn', () => {
  claims(
    'enpassant',
    'The chance lasts for your next turn, even after other actions.',
  );
  for (const actions of [
    ['e1d1', 'e5d6', 'd1e1'],
    ['e1d1', 'd1e1', 'e5d6'],
  ]) {
    let game = at('4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1', [KING, KING, PAWN]);
    for (const action of actions) game = moveGame(game, action);
    const board = viewGame(game).dfen.split(' ')[0];
    assert.equal(pieceAt(board, 'd6'), 'P');
    assert.equal(pieceAt(board, 'd5'), null);
    assert.equal(game.phase, 'handoff');
  }
  let unused = at('4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1', [KING, KING, KING]);
  for (const action of ['e1d1', 'd1e1', 'e1d1'])
    unused = moveGame(unused, action);
  assert.equal(nextTurn(unused).start.split(' ')[3], '-');
});

test('"a draw is agreed, and is not automatic" is what the engine does', () => {
  claims(
    'draws',
    'In a game against a friend, both players may agree a draw from the menu.',
  );
  claims(
    'draws',
    'Stalemate, repetition and insufficient material do not draw here.',
  );
  const hotseat = at(
    'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    [QUEEN, ROOK, KNIGHT],
    'draw',
  );
  assert.deepEqual(agreeDraw(hotseat).result, {
    winner: null,
    reason: 'agreed-draw',
  });
  // Against an opponent there is nobody to agree with.
  const solo = rollGame(newGame('random', 'solo'), [QUEEN, ROOK, KNIGHT]);
  assert.throws(() => agreeDraw(solo), /Draw agreement unavailable/);
});

test('"a player may resign" is what the engine does', () => {
  claims(
    'winning',
    'A player may resign, and in a game against a friend both players may agree a draw.',
  );
  const game = at(
    'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    [QUEEN, ROOK, KNIGHT],
    'resign',
  );
  assert.deepEqual(resignGame(game).result, {
    winner: 'b',
    reason: 'resigned',
  });
});

test('the app draws at turn end after 100 actions without a capture or pawn move', () => {
  claims(
    'draws',
    'At turn end, 100 actions without a capture or pawn move draw the game.',
  );
  assert.equal(topic('draws')?.title, 'Draws in this app');
  // Three quiet rook actions take the clock from 97 to 100.
  let game = at('4k3/8/8/8/8/8/8/R3K3 w - - 97 1', [ROOK, ROOK, ROOK], 'fifty');
  for (let i = 0; i < 3; i++) {
    // The boundary is the end of a turn, not the moment the count is reached:
    // the game is still in play while dice remain.
    assert.equal(game.phase, 'move', `ended early at ${i}`);
    assert.equal(game.result, null);
    game = moveGame(game, viewGame(game).legal[0]);
  }
  assert.equal(game.phase, 'ended');
  assert.deepEqual(game.result, { winner: null, reason: '100-halfmoves' });
});

// The game screen calls that draw "100 moves, no capture or pawn move" (#235).
// The count is of board actions, not turns or dice: each quiet action adds one,
// castling included, and a turn that passes with no action adds nothing.
test('the hundred counts board actions, and a passed turn adds none', () => {
  let game = at('4k3/8/8/8/8/8/8/R3K3 w - - 0 1', [ROOK, ROOK, ROOK], 'count');
  const count = () => viewGame(game).dfen.split(' ')[4];
  for (const after of ['1', '2', '3']) {
    game = moveGame(game, viewGame(game).legal[0]);
    assert.equal(count(), after);
  }
  assert.equal(nextTurn(game).start.split(' ')[4], '3');

  const castled = moveGame(
    at('4k3/8/8/8/8/8/8/4K2R w K - 0 1', [KING, ROOK, QUEEN]),
    'e1g1',
  );
  assert.equal(viewGame(castled).dfen.split(' ')[4], '1');

  // Queen, rook and king at the start: nothing can move, and the turn passes.
  const passed = at(
    'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 42 1',
    [QUEEN, ROOK, KING],
    'pass',
  );
  assert.deepEqual(passed.moves, []);
  assert.equal(passed.phase, 'handoff');
  assert.equal(nextTurn(passed).start.split(' ')[4], '42');
});

test('the app keeps playing after turn 4,999', () => {
  let game = rollGame(
    {
      ...newGame(
        'hotseat',
        'before-turn-limit',
        '4k3/8/8/8/8/8/8/R3K3 w - - 0 1',
      ),
      turn: 4999,
    },
    [ROOK, ROOK, ROOK],
  );
  for (let i = 0; i < 3; i++) {
    assert.equal(game.result, null);
    game = moveGame(game, viewGame(game).legal[0]);
  }
  assert.equal(game.phase, 'handoff');
  assert.equal(game.result, null);
});

test('the app also draws at the end of turn 5,000', () => {
  claims('draws', 'A game also draws at the end of turn 5,000.');
  let game = rollGame(
    {
      ...newGame('hotseat', 'turn-limit', '4k3/8/8/8/8/8/8/R3K3 w - - 0 1'),
      turn: 5000,
    },
    [ROOK, ROOK, ROOK],
  );
  for (let i = 0; i < 3; i++) {
    assert.equal(game.result, null);
    game = moveGame(game, viewGame(game).legal[0]);
  }
  assert.deepEqual(game.result, { winner: null, reason: 'turn-limit' });
});

test('topic() finds a topic and refuses an unknown one', () => {
  assert.equal(topic('dice')?.title, 'What the dice mean');
  assert.equal(topic('doubling'), undefined);
});

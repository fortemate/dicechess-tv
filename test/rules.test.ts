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
// and the engine drift apart silently: the behaviour stays right while the
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

test('"a king under attack is not in check" is what the engine does', () => {
  claims(
    'check',
    'A king under attack is not in check, and nothing warns you.',
  );
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

test('"a die with no legal move is lost" and "the turn passes" are what the engine does', () => {
  claims('dice', 'A die with no legal move is simply lost.');
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

test('"the turn ends when no die can be used" is what the engine does', () => {
  claims('turn', 'The turn ends when no die you hold can be used.');
  claims('turn', 'Each action spends one die.');
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

test('"a draw is agreed, and is not automatic" is what the engine does', () => {
  claims('draws', 'In hotseat, both players may agree a draw from the menu.');
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
    'A player may resign, and in hotseat both players may agree a draw.',
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

test('"a turn that ends 100 half-moves after the last capture or pawn move draws"', () => {
  claims(
    'winning',
    'A turn that ends 100 half-moves after the last capture or pawn move draws.',
  );
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

test('topic() finds a topic and refuses an unknown one', () => {
  assert.equal(topic('dice')?.title, 'What the dice mean');
  assert.equal(topic('doubling'), undefined);
});

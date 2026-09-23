import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cues } from '../src/core/cues.ts';
import {
  newGame,
  rollGame,
  moveGame,
  nextTurn,
  resignGame,
  agreeDraw,
  viewGame,
  type Game,
  type Mode,
} from '../src/core/game.ts';

const PAWN = 1;
const KNIGHT = 2;
const ROOK = 4;
const QUEEN = 5;
const KING = 6;

const OPENING = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

// A rolled game from a position, so each cue is checked against what the engine
// actually does rather than against a hand-built state.
const rolled = (start: string, roll: number[], mode: Mode = 'hotseat') =>
  rollGame(newGame(mode, 'cues', start), roll);

// Play one move the engine offers, and hear what it sounds like.
const hear = (game: Game, move: string) => {
  assert.ok(viewGame(game).legal.includes(move), `${move} is not legal here`);
  return cues(game, moveGame(game, move));
};

test('rolling the dice is heard as a roll', () => {
  const before = newGame('hotseat', 'cues');
  assert.deepEqual(cues(before, rollGame(before, [KNIGHT, ROOK, QUEEN])), [
    'dice_roll',
  ]);
});

test('a quiet move is heard as a move', () => {
  assert.deepEqual(hear(rolled(OPENING, [KNIGHT, KNIGHT, KNIGHT]), 'b1c3'), [
    'piece_move',
  ]);
});

test('taking a piece is heard as a capture', () => {
  assert.deepEqual(
    hear(rolled('4k3/8/8/8/8/8/p7/R3K3 w - - 0 1', [ROOK, ROOK, ROOK]), 'a1a2'),
    ['piece_capture'],
  );
});

test('en passant is a capture, though the target square is empty', () => {
  // The black pawn has just come from d7 to d5, beside the white pawn on e5.
  const game = rolled('4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1', [PAWN, PAWN, PAWN]);
  assert.deepEqual(hear(game, 'e5d6'), ['piece_capture']);
});

test('castling is heard as castling, not as a king move', () => {
  assert.deepEqual(
    hear(
      rolled('4k3/8/8/8/8/8/8/R3K2R w KQ - 0 1', [KING, ROOK, QUEEN]),
      'e1g1',
    ),
    ['castle'],
  );
});

test('promotion is heard as a promotion', () => {
  assert.deepEqual(
    hear(rolled('4k3/P7/8/8/8/8/8/4K3 w - - 0 1', [PAWN, PAWN, PAWN]), 'a7a8q'),
    ['promotion'],
  );
});

test('taking the king against the bot is a capture and then a win', () => {
  const game = rolled(
    'k7/8/8/8/8/8/8/R3K3 w - - 0 1',
    [ROOK, ROOK, ROOK],
    'random',
  );
  assert.deepEqual(hear(game, 'a1a8'), ['piece_capture', 'game_win']);
});

test('the bot taking the king is a capture and then a loss', () => {
  // The bot plays Black; here it is Black to move.
  const game = rolled(
    'K7/8/8/8/8/8/8/r3k3 b - - 0 1',
    [ROOK, ROOK, ROOK],
    'random',
  );
  assert.deepEqual(hear(game, 'a1a8'), ['piece_capture', 'game_loss']);
});

test('the side a person plays decides win or loss, not the colour', () => {
  // The same Black victory, heard by someone who played Black.
  const game = rolled(
    'K7/8/8/8/8/8/8/r3k3 b - - 0 1',
    [ROOK, ROOK, ROOK],
    'random',
  );
  const after = moveGame(game, 'a1a8');
  assert.deepEqual(cues(game, after, 'b'), ['piece_capture', 'game_win']);
});

test('a decisive hotseat game ends on the winning jingle, whoever won', () => {
  const game = rolled('K7/8/8/8/8/8/8/r3k3 b - - 0 1', [ROOK, ROOK, ROOK]);
  assert.deepEqual(hear(game, 'a1a8'), ['piece_capture', 'game_win']);
});

test('passing the dice to the other player is heard as a handoff', () => {
  let game = rolled(OPENING, [PAWN, PAWN, PAWN]);
  for (let i = 0; i < 3; i++) game = moveGame(game, viewGame(game).legal[0]);
  assert.equal(game.phase, 'handoff');
  assert.deepEqual(cues(game, nextTurn(game)), ['turn_handoff']);
});

test('a roll with nothing to play is only a roll; the handoff comes after', () => {
  // Three king dice, the king walled in by its own pieces.
  const before = newGame(
    'hotseat',
    'cues',
    '4k3/8/8/8/8/8/3PPP2/3PKP2 w - - 0 1',
  );
  const after = rollGame(before, [KING, KING, KING]);
  assert.equal(after.phase, 'handoff');
  assert.deepEqual(cues(before, after), ['dice_roll']);
});

test('resigning against the bot is a loss; resigning in hotseat is a win', () => {
  const solo = rolled(OPENING, [QUEEN, ROOK, KNIGHT], 'random');
  assert.deepEqual(cues(solo, resignGame(solo)), ['game_loss']);
  const shared = rolled(OPENING, [QUEEN, ROOK, KNIGHT]);
  assert.deepEqual(cues(shared, resignGame(shared)), ['game_win']);
});

test('an agreed draw is heard as a draw', () => {
  const game = rolled(OPENING, [QUEEN, ROOK, KNIGHT]);
  assert.deepEqual(cues(game, agreeDraw(game)), ['game_draw']);
});

test('the move that completes a hundred quiet half-moves is a move and then a draw', () => {
  let game = rolled('4k3/8/8/8/8/8/8/R3K3 w - - 97 1', [ROOK, ROOK, ROOK]);
  game = moveGame(game, viewGame(game).legal[0]);
  game = moveGame(game, viewGame(game).legal[0]);
  const last = viewGame(game).legal[0];
  assert.deepEqual(cues(game, moveGame(game, last)), [
    'piece_move',
    'game_draw',
  ]);
});

test('a different game, or no change at all, makes no sound', () => {
  const game = rolled(OPENING, [QUEEN, ROOK, KNIGHT]);
  assert.deepEqual(cues(game, newGame('hotseat', 'another')), []);
  assert.deepEqual(cues(game, game), []);
});

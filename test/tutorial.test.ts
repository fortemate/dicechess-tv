import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  TUTORIAL,
  stepGame,
  isComplete,
  type TutorialStep,
} from '../src/core/tutorial.ts';
import { moveGame, viewGame, decodeGame } from '../src/core/game.ts';
import { pieceAt } from '../src/core/board.ts';

// Play a step through, always taking the first legal action, until it is
// complete or there is nothing left to play.
const playOut = (
  step: TutorialStep,
  choose = (legal: string[]) => legal[0],
) => {
  let game = stepGame(step);
  for (let i = 0; i < 4 && !isComplete(step, game); i++) {
    const legal = viewGame(game).legal;
    if (!legal.length) break;
    game = moveGame(game, choose(legal));
  }
  return game;
};

test('every step starts from a position the engine accepts', () => {
  for (const step of TUTORIAL) {
    const game = stepGame(step);
    // stepGame goes through decodeGame, but assert it explicitly: a lesson
    // built on a position the controller would refuse is worse than no lesson.
    assert.deepEqual(decodeGame(JSON.stringify(game)), game);
    assert.equal(game.start.split(' ').length, 6, step.id);
    assert.deepEqual(game.roll, step.roll, step.id);
  }
});

test('every step offers the player something to do', () => {
  for (const step of TUTORIAL) {
    const state = viewGame(stepGame(step));
    assert.ok(state.legal.length > 0, `${step.id} has no legal action`);
    assert.equal(state.remaining.length, 3, step.id);
  }
});

test('every step can be completed, and is not complete before it is played', () => {
  for (const step of TUTORIAL) {
    assert.equal(
      isComplete(step, stepGame(step)),
      false,
      `${step.id} starts complete`,
    );
    const goal = step.goal;
    const finished = playOut(step, (legal) => {
      // Steps with a named target need that action chosen, not just any.
      if (goal.kind === 'capture')
        return legal.find((m) => m.slice(2, 4) === goal.square) ?? legal[0];
      if (goal.kind === 'kingCapture')
        return legal.find((m) => m.slice(2, 4) === 'a8') ?? legal[0];
      return legal[0];
    });
    assert.ok(isComplete(step, finished), `${step.id} could not be completed`);
  }
});

test('the dice lesson really does permit only knights', () => {
  const dice = TUTORIAL.find((step) => step.id === 'dice')!;
  const game = stepGame(dice);
  const state = viewGame(game);
  assert.equal(state.remaining, 'QRN');
  // Every legal action starts on a knight, which is what makes the lesson true.
  const board = state.dfen.split(' ')[0];
  for (const move of state.legal) {
    assert.equal(pieceAt(board, move.slice(0, 2)), 'N', move);
  }
});

test('the capture lesson has a pawn to take and the rook to take it with', () => {
  const capture = TUTORIAL.find((step) => step.id === 'capture')!;
  const game = stepGame(capture);
  const board = viewGame(game).dfen.split(' ')[0];
  assert.equal(pieceAt(board, 'd5'), 'p');
  assert.equal(pieceAt(board, 'd1'), 'R');
  assert.ok(viewGame(game).legal.includes('d1d5'));
  assert.ok(isComplete(capture, moveGame(game, 'd1d5')));
});

test('the king lesson ends the game by capture, not by anything else', () => {
  const king = TUTORIAL.find((step) => step.id === 'king')!;
  const game = stepGame(king);
  assert.ok(viewGame(game).legal.includes('a1a8'));
  const taken = moveGame(game, 'a1a8');
  assert.deepEqual(taken.result, { winner: 'w', reason: 'king-captured' });
  assert.ok(isComplete(king, taken));

  // A different rook move does not finish the lesson.
  const elsewhere = moveGame(game, 'a1a4');
  assert.equal(isComplete(king, elsewhere), false);
});

test('the tutorial teaches what the roadmap asks and defers the rest', () => {
  assert.deepEqual(
    TUTORIAL.map((step) => step.id),
    ['move', 'dice', 'turn', 'capture', 'king'],
  );
  // Castling and promotion are reference material, not a first lesson.
  const words = TUTORIAL.map((s) => `${s.instruction} ${s.note}`)
    .join(' ')
    .toLowerCase();
  assert.doesNotMatch(words, /castl|promot/);
});

test('a tutorial game is its own, and cannot be mistaken for a real one', () => {
  for (const step of TUTORIAL) {
    assert.match(stepGame(step).id, /^tutorial-/);
  }
  // Ids are distinct, so one step cannot be taken for another.
  const ids = TUTORIAL.map((step) => stepGame(step).id);
  assert.equal(new Set(ids).size, TUTORIAL.length);
});

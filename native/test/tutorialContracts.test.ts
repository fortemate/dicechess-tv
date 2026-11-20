import assert from 'node:assert/strict';
import { test } from 'node:test';
import { emptyRoll, moveGame, viewGame } from '../../src/core/game';
import { waitingFocus, type BoardKey } from '../../src/core/boardInput';
import type { Square } from '../../src/core/board';
import {
  TUTORIAL,
  closingGame,
  isComplete,
  isMissed,
  passStep,
  rollStep,
  stepGame,
} from '../../src/core/tutorial';
import { START } from '../src/screen';
import {
  CLOSING_CHOICES,
  initialTutorial,
  tutorialReducer,
  type TutorialInput,
  type TutorialState,
} from '../src/tutorial';

const KEYS: readonly BoardKey[] = [
  'up',
  'down',
  'left',
  'right',
  'select',
  'back',
  'menu',
];
const ARROWS = KEYS.slice(0, 4);

const at = (index: number): TutorialState => {
  const game = stepGame(TUTORIAL[index]);
  return {
    ...initialTutorial(),
    index,
    game,
    focus: waitingFocus(START, viewGame(game).legal),
  };
};

// Prepare a completed board with the canonical engine, independently of the
// reducer whose handling of the completed flag these tests characterize.
const completed = (index: number): TutorialState => {
  const state = at(index);
  const step = TUTORIAL[index];
  let game = rollStep(step, state.game);
  for (let count = 0; count < 4 && !isComplete(step, game); count++) {
    if (emptyRoll(game)) game = passStep(game);
    else {
      const legal = viewGame(game).legal;
      let move = legal[0];
      if (step.goal.kind === 'capture') {
        const square = step.goal.square;
        move = legal.find((action) => action.slice(2, 4) === square) ?? move;
      } else if (step.goal.kind === 'kingCapture') {
        move = legal.find((action) => action.slice(2, 4) === 'a8') ?? move;
      }
      assert.ok(move);
      game = moveGame(game, move);
    }
  }
  assert.ok(isComplete(step, game));
  return { ...state, game, complete: true };
};

const missed = (): TutorialState => {
  const index = TUTORIAL.findIndex((step) => step.id === 'capture');
  const state = at(index);
  const game = moveGame(rollStep(TUTORIAL[index], state.game), 'd1d2');
  assert.ok(isMissed(TUTORIAL[index], game));
  return { ...state, game };
};

const closing = (choice = 0): TutorialState => ({
  ...completed(TUTORIAL.length - 1),
  game: closingGame(),
  finished: true,
  choice,
});

const freeze = <T>(value: T): T => {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
};

test('an exited tutorial absorbs every input without changing its state reference', () => {
  const state = freeze({ ...closing(), exit: true });
  for (const key of KEYS) {
    assert.equal(tutorialReducer(state, key), state);
    assert.equal(tutorialReducer(state, { key, repeat: true }), state);
  }
});

test('string inputs and object inputs with no repeat preserve the same values and reference relationships', () => {
  const states = [
    at(0),
    tutorialReducer(at(0), 'select'),
    completed(0),
    completed(TUTORIAL.length - 1),
    missed(),
    closing(1),
  ];
  for (const state of states) {
    freeze(state);
    const before = JSON.stringify(state);
    for (const key of KEYS) {
      const plain = tutorialReducer(state, key);
      for (const input of [
        { key },
        { key, repeat: false },
      ] satisfies TutorialInput[]) {
        const result = tutorialReducer(state, input);
        assert.deepEqual(result, plain);
        assert.equal(result === state, plain === state);
        assert.equal(result.game === state.game, plain.game === state.game);
        assert.equal(result.focus === state.focus, plain.focus === state.focus);
      }
    }
    assert.equal(JSON.stringify(state), before);
  }
});

test('every lesson ignores arrows before its fixed roll and leaves on Back or Menu', () => {
  for (let index = 0; index < TUTORIAL.length; index++) {
    const state = freeze(at(index));
    for (const key of ARROWS) assert.equal(tutorialReducer(state, key), state);
    for (const key of ['back', 'menu'] as const) {
      const leaving = tutorialReducer(state, key);
      assert.equal(leaving.exit, true);
      assert.equal(leaving.game, state.game);
      assert.equal(leaving.focus, state.focus);
    }
    const rolled = tutorialReducer(state, { key: 'select', repeat: true });
    assert.deepEqual(rolled.game.roll, TUTORIAL[index].roll);
    assert.equal(rolled.focus.selected, null);
    assert.equal(rolled.index, index);
    assert.equal(rolled.complete, false);
    assert.equal(state.game.phase, 'roll');
  }
});

test('a completed lesson ignores arrows by identity and OK starts the next lesson before its roll', () => {
  for (let index = 0; index < TUTORIAL.length - 1; index++) {
    const state = freeze(completed(index));
    for (const key of ARROWS) assert.equal(tutorialReducer(state, key), state);
    assert.deepEqual(tutorialReducer(state, 'select'), at(index + 1));
    assert.equal(tutorialReducer(state, 'back').exit, true);
    assert.equal(tutorialReducer(state, 'menu').exit, true);
  }
});

test('completing the last lesson opens the closing board and clears only its selection', () => {
  const state = freeze({
    ...completed(TUTORIAL.length - 1),
    focus: { cursor: 'e4' as Square, selected: 'e2' as Square },
  });
  const next = tutorialReducer(state, 'select');
  assert.equal(next.finished, true);
  assert.equal(next.complete, true);
  assert.equal(next.index, state.index);
  assert.deepEqual(next.game, closingGame());
  assert.deepEqual(next.focus, { cursor: 'e4', selected: null });
  assert.equal(next.exit, false);
  assert.equal(next.next, null);
});

test('closing choices wrap in each direction even while the final lesson remains complete', () => {
  for (let choice = 0; choice < CLOSING_CHOICES.length; choice++) {
    const state = freeze(closing(choice));
    for (const key of ARROWS) {
      const result = tutorialReducer(state, { key, repeat: true });
      const change = key === 'up' || key === 'left' ? -1 : 1;
      assert.equal(
        result.choice,
        (choice + change + CLOSING_CHOICES.length) % CLOSING_CHOICES.length,
      );
      assert.equal(result.game, state.game);
      assert.equal(result.focus, state.focus);
      assert.equal(result.exit, false);
      assert.equal(result.next, null);
    }
  }
});

test('closing OK returns the selected static game choice while Back and Menu choose none', () => {
  for (let choice = 0; choice < CLOSING_CHOICES.length; choice++) {
    const state = freeze(closing(choice));
    const selected = tutorialReducer(state, 'select');
    assert.equal(selected.exit, true);
    assert.equal(selected.next, CLOSING_CHOICES[choice].game);
    for (const key of ['back', 'menu'] as const) {
      const leaving = tutorialReducer(state, key);
      assert.equal(leaving.exit, true);
      assert.equal(leaving.next, null);
      assert.equal(leaving.game, state.game);
      assert.equal(leaving.focus, state.focus);
    }
  }
});

test('a missed goal ignores arrows and OK resets that same lesson before its roll', () => {
  const state = freeze(missed());
  for (const key of ARROWS) assert.equal(tutorialReducer(state, key), state);
  assert.deepEqual(tutorialReducer(state, 'select'), at(state.index));
  assert.equal(tutorialReducer(state, 'back').exit, true);
  assert.equal(tutorialReducer(state, 'menu').exit, true);
});

test('an unusable roll passes only on OK and preserves the existing focus reference', () => {
  const index = TUTORIAL.findIndex((step) => step.id === 'pass');
  const state = freeze(tutorialReducer(at(index), 'select'));
  assert.ok(emptyRoll(state.game));
  for (const key of ARROWS) assert.equal(tutorialReducer(state, key), state);
  const passed = tutorialReducer(state, 'select');
  assert.equal(passed.complete, true);
  assert.ok(isComplete(TUTORIAL[index], passed.game));
  assert.equal(passed.focus, state.focus);
  assert.equal(tutorialReducer(state, 'back').exit, true);
});

test('held arrows do not wrap, while a fresh arrow can wrap between legal pieces', () => {
  const state = freeze({
    ...tutorialReducer(at(0), 'select'),
    focus: { cursor: 'a2' as Square, selected: null },
  });
  const fresh = tutorialReducer(state, 'left');
  const held = tutorialReducer(state, { key: 'left', repeat: true });
  assert.equal(fresh.focus.cursor, 'h2');
  assert.equal(held.focus.cursor, 'a2');
  assert.notEqual(held, state);
  assert.notEqual(held.focus, state.focus);
  assert.equal(held.game, state.game);
});

test('Back cancels a board selection before leaving and Menu retains the exiting state focus', () => {
  const state = tutorialReducer(tutorialReducer(at(0), 'select'), 'select');
  freeze(state);
  assert.notEqual(state.focus.selected, null);
  const cancelled = tutorialReducer(state, 'back');
  assert.equal(cancelled.exit, false);
  assert.equal(cancelled.focus.cursor, state.focus.selected);
  assert.equal(cancelled.focus.selected, null);
  assert.equal(cancelled.game, state.game);
  assert.equal(tutorialReducer(cancelled, 'back').exit, true);
  const menu = tutorialReducer(state, 'menu');
  assert.equal(menu.exit, true);
  assert.equal(menu.focus, state.focus);
});

test('a selected legal action uses the canonical controller and leaves its input untouched', () => {
  const rolled = tutorialReducer(at(0), 'select');
  const move = viewGame(rolled.game).legal[0];
  const state = freeze({
    ...rolled,
    focus: {
      cursor: move.slice(2, 4) as Square,
      selected: move.slice(0, 2) as Square,
    },
  });
  const before = JSON.stringify(state);
  const result = tutorialReducer(state, 'select');
  assert.deepEqual(result.game, moveGame(state.game, move));
  assert.equal(result.complete, isComplete(TUTORIAL[0], result.game));
  assert.equal(result.focus.selected, null);
  assert.equal(JSON.stringify(state), before);
});

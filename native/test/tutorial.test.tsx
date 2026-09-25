import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import renderer, { act } from 'react-test-renderer';
import {
  press,
  pressBack,
  listenerCount,
  hasExited,
  clearExit,
} from './stubs/react-native-kepler.mjs';
import { reset } from './stubs/react-native-mmkv.mjs';
import { App } from '../src/App';
import { MmkvSnapshotStore } from '../src/mmkvStore';
import { decodeGame, viewGame, type Game } from '../../src/core/game';
import { decodeLedger, type Ledger } from '../../src/core/ledger';
import { TUTORIAL, isComplete, stepGame } from '../../src/core/tutorial';
import { initialTutorial, tutorialReducer, step } from '../src/tutorial';
import {
  movableSquares,
  movesFrom,
  type BoardKey,
} from '../../src/core/boardInput';
import { route, RULE } from '../../src/core/cursor';
import type { ScreenOptions } from '../src/screen';
import { RULES } from '../../src/core/rules';
import { focusedLabel, optionViews } from './options';

type Instance = renderer.ReactTestInstance;

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const options: ScreenOptions = {
  roll: () => [5, 4, 2],
  newId: () => 'tut',
  schedule: (fn) => fn(),
  // Random draws White unless a test says otherwise.
  side: () => 'w',
};

// A launch replaces the app a previous launch left mounted, as a relaunch does.
// A tree left mounted would still hear every key and write the same storage.
let mounted: renderer.ReactTestRenderer | null = null;
const launch = (): Instance => {
  if (mounted) act(() => mounted!.unmount());
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(React.createElement(App, { options }));
  });
  mounted = tree;
  return tree.root;
};

// Back arrives on its own channel: Vega routes it through a hook that lets the
// app claim the press, which is what stops the system closing the app.
const send = (...keys: string[]) => {
  for (const key of keys)
    act(() => {
      if (key === 'back') pressBack();
      else press(key);
    });
};

const text = (root: Instance) =>
  root
    .findAll((node) => (node.type as unknown as string) === 'Text', {
      deep: true,
    })
    .map((node) => String(node.props.children))
    .join('\n');

// Play the current step by taking the action it teaches, through the reducer.
const solve = (state: ReturnType<typeof initialTutorial>) => {
  const current = step(state);
  const goal = current.goal;
  let played = state;
  for (let i = 0; i < 4 && !played.complete; i++) {
    const legal = viewGame(played.game).legal;
    if (!legal.length) break;
    const move =
      goal.kind === 'capture'
        ? (legal.find((m) => m.slice(2, 4) === goal.square) ?? legal[0])
        : goal.kind === 'kingCapture'
          ? (legal.find((m) => m.slice(2, 4) === 'a8') ?? legal[0])
          : legal[0];
    // Jump to the piece and pick it up, then jump to the target and play it.
    const [from, to] = [move.slice(0, 2), move.slice(2, 4)];
    const holding = [
      ...jumps(played.focus.cursor, from, movableSquares(legal)),
      'select' as const,
    ].reduce((s, key) => tutorialReducer(s, key), played);
    const targets = movesFrom(legal, from).map((action) => action.slice(2, 4));
    played = [
      ...jumps(holding.focus.cursor, to, targets),
      'select' as const,
    ].reduce((s, key) => tutorialReducer(s, key), holding);
  }
  return played;
};

// The jumps from `from` to `to` among `options`, as the reducer makes them.
const jumps = (from: string, to: string, options: string[]): BoardKey[] => {
  const keys = route(from, to, options, { rule: RULE });
  assert.ok(keys, `${to} is out of reach`);
  return keys;
};

test('every lesson can be completed through the same input the game uses', () => {
  let state = initialTutorial();
  for (let i = 0; i < TUTORIAL.length; i++) {
    assert.equal(state.index, i);
    state = solve(state);
    assert.ok(state.complete, `lesson ${step(state).id} could not be finished`);
    state = tutorialReducer(state, 'select');
  }
  assert.ok(state.finished);
});

test('it is skippable at any point, and Back cancels a selection first', () => {
  // From the first lesson.
  assert.ok(tutorialReducer(initialTutorial(), 'back').exit);

  // With a piece in hand, Back puts it down rather than leaving. The cursor
  // starts on a pawn, and the first lesson rolls three pawns.
  const holding = tutorialReducer(initialTutorial(), 'select');
  assert.notEqual(holding.focus.selected, null);
  const cancelled = tutorialReducer(holding, 'back');
  assert.equal(cancelled.focus.selected, null);
  assert.equal(cancelled.exit, false);
  assert.ok(tutorialReducer(cancelled, 'back').exit);

  // And between lessons.
  const done = solve(initialTutorial());
  assert.ok(tutorialReducer(done, 'back').exit);
});

test('the board takes no input once a lesson is done', () => {
  const done = solve(initialTutorial());
  assert.equal(tutorialReducer(done, 'up'), done);
  assert.equal(tutorialReducer(done, 'right'), done);
});

test('a lesson is played on its own game, not on a real one', () => {
  for (const s of TUTORIAL) {
    assert.match(stepGame(s).id, /^tutorial-/);
  }
  const state = solve(initialTutorial());
  assert.ok(isComplete(step(state), state.game));
  assert.match(state.game.id, /^tutorial-/);
});

test('playing the tutorial changes neither the saved game nor the record', () => {
  reset();
  const root = launch();
  // Play a real game to a result first, so there is something to protect.
  send('enter', 'enter');
  send('back', 'down', 'select', 'down', 'select');
  send('enter');
  const games = new MmkvSnapshotStore<Game>({
    key: 'dicechess-tv.game.v2',
    decode: decodeGame,
  });
  const ledgers = new MmkvSnapshotStore<Ledger>({
    key: 'dicechess-tv.ledger.v1',
    decode: decodeLedger,
  });
  const savedBefore = JSON.stringify(games.read());
  const ledgerBefore = JSON.stringify(ledgers.read());
  assert.notEqual(ledgerBefore, 'null');

  // Open the tutorial. The finished game is not resumable, so the home screen
  // offers three choices and How to play is the last.
  send('down', 'down', 'enter');
  assert.match(text(root), /HOW TO PLAY/);
  send('right', 'down', 'enter', 'up', 'enter');

  assert.equal(JSON.stringify(games.read()), savedBefore);
  assert.equal(JSON.stringify(ledgers.read()), ledgerBefore);
});

test('the tutorial takes the remote, so a press is not handled twice', () => {
  reset();
  const root = launch();
  // Trees from earlier tests stay mounted, so count the change rather than the
  // total.
  const before = listenerCount();

  send('down', 'down', 'enter');
  assert.match(text(root), /HOW TO PLAY/);
  // Both screens are mounted and both are listening, because a hook cannot be
  // conditional. The game screen must ignore keys, or every press would move
  // the cursor twice and start games behind the lesson.
  assert.equal(listenerCount(), before + 1);

  send('right');
  assert.match(text(root), /HOW TO PLAY/);
  send('back');
  assert.match(text(root), /Dice Chess/);
  assert.equal(listenerCount(), before);
});

test('leaving the tutorial returns to the home screen', () => {
  reset();
  const root = launch();
  send('down', 'down', 'enter');
  assert.match(text(root), /HOW TO PLAY/);
  send('back');
  assert.doesNotMatch(text(root), /HOW TO PLAY/);
  assert.match(text(root), /Dice Chess/);
});

test('the panel says which of the two things Back will do', () => {
  reset();
  const root = launch();
  send('down', 'down', 'enter');
  assert.match(text(root), /Back: leave the tutorial/);

  // With a piece in hand Back puts it down, and the panel says so rather than
  // promising to leave.
  send('enter');
  assert.match(text(root), /Back: put the piece down/);
  assert.doesNotMatch(text(root), /Back: leave the tutorial/);

  send('back');
  assert.match(text(root), /Back: leave the tutorial/);
  assert.match(text(root), /HOW TO PLAY/);

  send('back');
  assert.match(text(root), /Dice Chess/);
});

test('Back leaves from a finished lesson too', () => {
  reset();
  const root = launch();
  send('down', 'down', 'enter');
  // Play the first lesson: the cursor starts on a pawn the dice allow.
  send('enter', 'up', 'enter');
  assert.match(text(root), /Done\. OK: next lesson · Back: leave/);
  send('back');
  assert.match(text(root), /Dice Chess/);
});

test('the rules guide opens, moves between topics and returns', () => {
  reset();
  const root = launch();
  // Home: new hotseat, Play Random, How to play, Rules.
  send('down', 'down', 'down', 'enter');
  assert.match(text(root), /RULES/);
  assert.match(text(root), /How a game ends/);
  assert.match(text(root), /There is no checkmate/);
  // The topics are framed options, not text behind a caret, so a title that
  // wraps keeps its second line under its first.
  assert.deepEqual(
    optionViews(root).map(({ label }) => label),
    RULES.map(({ title }) => title),
  );
  assert.equal(focusedLabel(root), RULES[0].title);

  // Moving down changes the text without opening anything.
  send('down');
  assert.match(text(root), /Your turn/);
  assert.match(text(root), /Each action spends one die/);

  // Up from the first topic wraps, so a remote never reaches a dead end.
  send('up', 'up');
  assert.match(text(root), /Draws/);

  send('back');
  assert.match(text(root), /Dice Chess/);
});

test('the guide never touches a game or the record', () => {
  reset();
  const root = launch();
  send('enter', 'enter');
  send('back', 'down', 'select', 'down', 'select');
  send('enter');
  const games = new MmkvSnapshotStore<Game>({
    key: 'dicechess-tv.game.v2',
    decode: decodeGame,
  });
  const ledgers = new MmkvSnapshotStore<Ledger>({
    key: 'dicechess-tv.ledger.v1',
    decode: decodeLedger,
  });
  const savedBefore = JSON.stringify(games.read());
  const ledgerBefore = JSON.stringify(ledgers.read());

  send('down', 'down', 'down', 'enter');
  assert.match(text(root), /RULES/);
  send('down', 'down', 'back');

  assert.equal(JSON.stringify(games.read()), savedBefore);
  assert.equal(JSON.stringify(ledgers.read()), ledgerBefore);
});

test('the About screen shows the credits and returns on Back or OK', () => {
  reset();
  clearExit();
  const root = launch();
  // About is the last item and the menu wraps, so Up from the top reaches it
  // however many items are added above.
  send('up', 'enter');
  assert.match(text(root), /ABOUT/);
  // The credit a licence requires is only met if it is on the screen.
  assert.match(text(root), /Vector Chess Pieces by RhosGFX/);
  assert.match(text(root), /Dice Chess engine by Fortemate/);
  assert.match(text(root), /CC0 1\.0/);

  // Back returns to the menu, and is claimed — it must not close the app.
  send('back');
  assert.equal(hasExited(), false, 'Back on About closed the app');
  assert.doesNotMatch(text(root), /ABOUT/);
  assert.match(text(root), /New hotseat game/);

  // OK leaves too: there is nothing on this page to select. The cursor came back
  // to the top of the menu, so Up reaches About again.
  send('up', 'enter');
  assert.match(text(root), /ABOUT/);
  send('enter');
  assert.doesNotMatch(text(root), /ABOUT/);
  assert.match(text(root), /New hotseat game/);
});

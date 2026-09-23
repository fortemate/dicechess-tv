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
import type { BoardKey } from '../../src/core/boardInput';
import type { ScreenOptions } from '../src/screen';

type Instance = renderer.ReactTestInstance;

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const options: ScreenOptions = {
  roll: () => [5, 4, 2],
  newId: () => 'tut',
  schedule: (fn) => fn(),
};

const launch = (): Instance => {
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(React.createElement(App, { options }));
  });
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
    // Walk the cursor to the piece, select it, walk to the target, select.
    played = [
      ...walk(played.focus.cursor, move.slice(0, 2)),
      'select' as const,
      ...walk(move.slice(0, 2), move.slice(2, 4)),
      'select' as const,
    ].reduce((s, key) => tutorialReducer(s, key as BoardKey), played);
  }
  return played;
};

const walk = (from: string, to: string): BoardKey[] => {
  const keys: BoardKey[] = [];
  const file = to.charCodeAt(0) - from.charCodeAt(0);
  const rank = Number(to[1]) - Number(from[1]);
  for (let i = 0; i < Math.abs(file); i++)
    keys.push(file > 0 ? 'right' : 'left');
  for (let i = 0; i < Math.abs(rank); i++) keys.push(rank > 0 ? 'up' : 'down');
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
  // Nothing saved, so no Resume: new hotseat, Play Random, How to play, Rules,
  // About. About is last and stays last, so this path does not move when a
  // menu item is added above it.
  send('down', 'down', 'down', 'down', 'enter');
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

  // OK leaves too: there is nothing on this page to select.
  send('down', 'down', 'down', 'down', 'enter');
  assert.match(text(root), /ABOUT/);
  send('enter');
  assert.doesNotMatch(text(root), /ABOUT/);
  assert.match(text(root), /New hotseat game/);
});

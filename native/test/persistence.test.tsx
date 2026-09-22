import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { press } from './stubs/react-native-kepler.mjs';
import { reset } from './stubs/react-native-mmkv.mjs';
import { App } from '../src/App';
import { MmkvSnapshotStore } from '../src/mmkvStore';
import {
  newGame,
  rollGame,
  moveGame,
  decodeGame,
  type Game,
} from '../../src/core/game';

type Instance = renderer.ReactTestInstance;

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

// Each mount is a fresh process against the same storage, which is what a
// relaunch is.
const launch = (): Instance => {
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(React.createElement(App));
  });
  return tree.root;
};

const send = (...keys: string[]) => {
  for (const key of keys) act(() => press(key));
};

const text = (root: Instance) =>
  root
    .findAll((node) => (node.type as unknown as string) === 'Text', {
      deep: true,
    })
    .map((node) => String(node.props.children))
    .join('\n');

const store = () =>
  new MmkvSnapshotStore<Game>({
    key: 'dicechess-tv.game.v2',
    decode: decodeGame,
  });

test('a turn in progress survives a relaunch exactly as it was left', () => {
  reset();
  const first = launch();
  // Roll, then play b1c3 with the knight die.
  send(
    'enter',
    'down',
    'left',
    'left',
    'left',
    'enter',
    'up',
    'up',
    'right',
    'enter',
  );
  assert.match(text(first), /Remaining: Queen · Rook/);

  const second = launch();
  assert.match(text(second), /Remaining: Queen · Rook/);
  assert.match(text(second), /TURN 1/);
  const saved = store().read()!;
  assert.deepEqual(saved.moves, ['b1c3']);
  assert.equal(saved.lastMove, 'b1c3');
  assert.equal(saved.phase, 'move');
  // The original roll is kept, so a restart cannot reroll a partial turn.
  assert.deepEqual(saved.roll, [5, 4, 2]);
});

test('nothing is saved before the player does anything', () => {
  reset();
  launch();
  assert.equal(store().read(), null);
});

test('the cursor is not part of the saved game', () => {
  reset();
  const first = launch();
  send('enter', 'up', 'up', 'right');
  assert.match(text(first), /Cursor f4/);
  // A relaunch starts the cursor where a new screen starts it, not where the
  // player left it: where someone is looking is not game state.
  assert.match(text(launch()), /Cursor e2/);
});

test('a damaged save is surfaced and cleared, not silently played over', () => {
  reset();
  const first = launch();
  send('enter');
  assert.notEqual(store().read(), null);

  // Corrupt the stored snapshot the way a bad migration would.
  const raw = JSON.parse(JSON.stringify(store().read()));
  raw.phase = 'nonsense';
  new MmkvSnapshotStore<Game>({
    key: 'dicechess-tv.game.v2',
    decode: () => raw as Game,
  }).save(raw);

  const second = launch();
  // The board is usable rather than stuck, and the unreadable save is gone.
  assert.match(text(second), /OK: roll three dice/);
  assert.equal(store().read(), null);
  assert.ok(text(first).length > 0);
});

test('a damaged snapshot never replaces a good one', async () => {
  reset();
  const good = moveGame(
    rollGame(newGame('hotseat', 'keep'), [5, 4, 2]),
    'b1c3',
  );
  const saver = store();
  await saver.save(good);

  // A snapshot that cannot decode is rejected before anything is written.
  await assert.rejects(() =>
    saver.save({ ...good, phase: 'nonsense' } as unknown as Game),
  );
  assert.deepEqual(store().read()!.moves, ['b1c3']);
});

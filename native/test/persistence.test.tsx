import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { press } from './stubs/react-native-kepler.mjs';
import { reset } from './stubs/react-native-mmkv.mjs';
import { App } from '../src/App';
import { MmkvSnapshotStore } from '../src/mmkvStore';
import type { ScreenOptions } from '../src/screen';
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
// A fixed instructional roll: queen, rook, knight. The app itself uses the
// device's random source; a test must not.
const options: ScreenOptions = {
  roll: () => [5, 4, 2],
  newId: () => 'test',
  // The opponent steps immediately in tests; the app spaces the steps out.
  schedule: (step) => step(),
  // Random draws White unless a test says otherwise.
  side: () => 'w',
};

type Launched = { root: Instance; state: () => string };

// A launch replaces the app a previous launch left mounted, as a relaunch does.
// A tree left mounted would still hear every key and write the same storage.
let mounted: renderer.ReactTestRenderer | null = null;
const launch = (): Launched => {
  if (mounted) act(() => mounted!.unmount());
  let tree!: renderer.ReactTestRenderer;
  const reports: string[] = [];
  act(() => {
    tree = renderer.create(
      React.createElement(App, {
        options,
        onState: (line: string) => reports.push(line),
      }),
    );
  });
  mounted = tree;
  return { root: tree.root, state: () => reports[reports.length - 1] ?? '' };
};

// Home is always the entry: OK takes the first option, which is Resume when
// there is a saved game and a new hotseat game when there is not.
const enter = (launched: Launched): Launched => {
  act(() => press('enter'));
  return launched;
};

const send = (...keys: string[]) => {
  for (const key of keys) act(() => press(key));
};

const store = () =>
  new MmkvSnapshotStore<Game>({
    key: 'dicechess-tv.game.v2',
    decode: decodeGame,
  });

test('a turn in progress survives a relaunch exactly as it was left', () => {
  reset();
  const first = enter(launch());
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
  assert.match(first.state(), /dice "QR"/);

  const second = launch();
  // A restored game opens on the home screen; OK resumes it.
  assert.match(second.state(), /overlay home/);
  send('enter');
  assert.match(second.state(), /overlay none \| turn 1 \| phase move/);
  assert.match(second.state(), /dice "QR" \| legal 1/);
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
  const first = enter(launch());
  // After the roll the cursor waits on the g1 knight; Left takes it to b1.
  send('enter', 'left');
  assert.match(first.state(), /cursor b1/);
  // A relaunch waits on a piece as a new screen does, from e2, not where the
  // player left it: where someone is looking is not game state.
  const second = launch();
  send('enter');
  assert.match(second.state(), /cursor g1/);
});

test('a damaged save is surfaced and cleared, not silently played over', () => {
  reset();
  enter(launch());
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
  // The unreadable save is gone rather than being played over, and the app
  // opens normally instead of getting stuck on it.
  assert.equal(store().read(), null);
  assert.match(second.state(), /overlay home/);
  // Only a new game is offered, because there is nothing left to resume.
  act(() => press('enter'));
  assert.match(second.state(), /overlay none \| turn 1 \| phase roll/);
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

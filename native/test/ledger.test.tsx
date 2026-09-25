import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { press, pressBack } from './stubs/react-native-kepler.mjs';
import { reset } from './stubs/react-native-mmkv.mjs';
import { App } from '../src/App';
import { MmkvSnapshotStore } from '../src/mmkvStore';
import { decodeLedger, type Ledger } from '../../src/core/ledger';
import { decodeGame, type Game } from '../../src/core/game';
import type { ScreenOptions } from '../src/screen';

type Instance = renderer.ReactTestInstance;

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const options: ScreenOptions = {
  roll: () => [5, 4, 2],
  newId: () => 'ledgertest',
  schedule: (step) => step(),
  // Random draws White unless a test says otherwise.
  side: () => 'w',
};

// Each mount is a fresh process against the same storage, which is what a
// relaunch is.
// A launch replaces the app a previous launch left mounted, as a relaunch does.
// A tree left mounted would still hear every key and write the same storage.
let mounted: renderer.ReactTestRenderer | null = null;
const launch = (opts: ScreenOptions = options): Instance => {
  if (mounted) act(() => mounted!.unmount());
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(React.createElement(App, { options: opts }));
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

const ledger = (): Ledger | null =>
  new MmkvSnapshotStore<Ledger>({
    key: 'dicechess-tv.ledger.v1',
    decode: decodeLedger,
  }).read();

// Start a hotseat game, roll, then resign through the menu.
const playAndResign = () => {
  send('enter', 'enter');
  send('back', 'down', 'select', 'down', 'select');
};

test('a finished game is counted, and the home screen shows it', () => {
  reset();
  const root = launch();
  assert.equal(ledger(), null);

  playAndResign();
  assert.deepEqual(ledger()?.hotseat, { white: 0, draws: 0, black: 1 });

  // Back to the home screen, where a player is told what has been played.
  send('enter');
  assert.match(text(root), /COMPLETED GAMES/);
  assert.match(text(root), /Hotseat — White 0 · Drawn 0 · Black 1/);
});

test('a result already on screen when the app dies is counted exactly once', () => {
  reset();
  launch();
  playAndResign();
  assert.equal(ledger()?.hotseat.black, 1);
  assert.equal(ledger()?.lastCountedId, 'ledgertest');

  // The game ended, and the app is killed while still showing the result.
  // Every relaunch offers that same finished game again.
  for (let i = 0; i < 3; i++) launch();
  assert.equal(ledger()?.hotseat.black, 1);
});

test('a game ended before the ledger was written is counted on the next launch', () => {
  reset();
  launch();
  playAndResign();
  const counted = ledger()!;

  // Simulate the crash window: the game is saved as ended, the ledger is not.
  new MmkvSnapshotStore<Ledger>({
    key: 'dicechess-tv.ledger.v1',
    decode: decodeLedger,
  }).clear();
  assert.equal(ledger(), null);

  launch();
  assert.deepEqual(ledger()?.hotseat, counted.hotseat);
  assert.equal(ledger()?.lastCountedId, 'ledgertest');
});

test('an abandoned game is never counted', () => {
  reset();
  launch();
  // Start a game, roll, then replace it without finishing.
  send('enter', 'enter');
  send('back', 'down', 'down', 'down', 'select', 'down', 'select');
  assert.equal(ledger(), null);
});

test('nothing is shown before a game has been completed', () => {
  reset();
  const root = launch();
  assert.doesNotMatch(text(root), /COMPLETED GAMES/);
});

test('a game played as Black is counted under Black', () => {
  reset();
  launch({ ...options, side: () => 'b' });
  // Play Random, Random on the colour choice (drawn Black); the bot, White,
  // takes its turn. Then resign.
  send('down', 'enter', 'enter');
  send('back', 'down', 'select', 'down', 'select');
  assert.deepEqual(ledger()?.bots.random, {
    b: { wins: 0, draws: 0, losses: 1 },
  });
});

test('a rematch counts the finished game once, and its own result after it', () => {
  reset();
  let ids = 0;
  launch({ ...options, newId: () => 'rematch' + ++ids });
  // Play Random, Random on the colour choice (drawn White), then resign.
  send('down', 'enter', 'enter');
  send('back', 'down', 'select', 'down', 'select');
  const lost = (losses: number) => ({ w: { wins: 0, draws: 0, losses } });
  assert.deepEqual(ledger()?.bots.random, lost(1));
  const finished = ledger()?.lastCountedId;

  // OK on Rematch, which has the focus: a new game is saved, and the finished
  // one is not counted again.
  send('enter');
  assert.deepEqual(ledger()?.bots.random, lost(1));
  const saved = new MmkvSnapshotStore<Game>({
    key: 'dicechess-tv.game.v2',
    decode: decodeGame,
  }).read();
  assert.notEqual(saved?.id, finished);
  assert.equal(saved?.phase, 'roll');
  assert.equal(saved?.colour, 'random');

  send('back', 'down', 'select', 'down', 'select');
  assert.deepEqual(ledger()?.bots.random, lost(2));
});

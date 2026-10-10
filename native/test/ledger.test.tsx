import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reset } from './stubs/react-native-mmkv.mjs';
import { MmkvSnapshotStore } from '../src/mmkvStore';
import { decodeLedger, type Ledger } from '../../src/core/ledger';
import { decodeGame, type Game } from '../../src/core/game';
import { fakeTimers, fixedOptions, launch, send, text } from './support';

// Each launch is a fresh process against the same storage, which is what a
// relaunch is. The app's sounds, music and voices run on the test's clock.
fakeTimers();

const options = fixedOptions({ newId: () => 'ledgertest' });

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

test('a finished game is counted, and the home screen shows no hotseat record', () => {
  reset();
  const { root } = launch({ options });
  assert.equal(ledger(), null);

  playAndResign();
  assert.deepEqual(ledger()?.hotseat, { white: 0, draws: 0, black: 1 });

  // Back to the home screen: counts by colour say nothing about who played, so
  // the menu stands alone. Nothing else shows the record either.
  send('enter');
  assert.doesNotMatch(text(root), /COMPLETED GAMES/);
  assert.doesNotMatch(text(root), /Hotseat —/);
});

test('a result already on screen when the app dies is counted exactly once', () => {
  reset();
  launch({ options });
  playAndResign();
  assert.equal(ledger()?.hotseat.black, 1);
  assert.equal(ledger()?.lastCountedId, 'ledgertest');

  // The game ended, and the app is killed while still showing the result.
  // Every relaunch offers that same finished game again.
  for (let i = 0; i < 3; i++) launch({ options });
  assert.equal(ledger()?.hotseat.black, 1);
});

test('a game ended before the ledger was written is counted on the next launch', () => {
  reset();
  launch({ options });
  playAndResign();
  const counted = ledger()!;

  // Simulate the crash window: the game is saved as ended, the ledger is not.
  new MmkvSnapshotStore<Ledger>({
    key: 'dicechess-tv.ledger.v1',
    decode: decodeLedger,
  }).clear();
  assert.equal(ledger(), null);

  launch({ options });
  assert.deepEqual(ledger()?.hotseat, counted.hotseat);
  assert.equal(ledger()?.lastCountedId, 'ledgertest');
});

test('an abandoned game is never counted', () => {
  reset();
  launch({ options });
  // Start a game, roll, then replace it without finishing.
  send('enter', 'enter');
  send('back', 'down', 'down', 'down', 'select', 'down', 'select');
  assert.equal(ledger(), null);
});

test('a game played as Black is counted under Black', () => {
  reset();
  launch({ options: { ...options, side: () => 'b' } });
  // Play the computer, Rolly, Random on the colour choice (drawn Black); the
  // bot, White, takes its turn. Then resign.
  send('down', 'enter', 'enter', 'enter');
  send('back', 'down', 'select', 'down', 'select');
  assert.deepEqual(ledger()?.bots.random, {
    b: { wins: 0, draws: 0, losses: 1 },
  });
});

test('a rematch counts the finished game once, and its own result after it', () => {
  reset();
  let ids = 0;
  launch({ options: { ...options, newId: () => 'rematch' + ++ids } });
  // Play the computer, Rolly, Random on the colour choice (drawn White), then
  // resign.
  send('down', 'enter', 'enter', 'enter');
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

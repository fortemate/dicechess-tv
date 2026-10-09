import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MMKV, reset } from './stubs/react-native-mmkv.mjs';
import { MmkvSnapshotStore } from '../src/mmkvStore';
import {
  newGame,
  rollGame,
  moveGame,
  decodeGame,
  type Game,
} from '../../src/core/game';
import { decodeLedger, type Ledger } from '../../src/core/ledger';
import { fakeTimers, launch, send, type Launched } from './support';

// Each launch is a fresh process against the same storage, which is what a
// relaunch is. The app's sounds, music and voices run on the test's clock.
fakeTimers();

// Home is always the entry: OK takes the first option, which is Resume when
// there is a saved game and a new hotseat game when there is not.
const enter = (launched: Launched): Launched => {
  send('enter');
  return launched;
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
  assert.match(second.state(), /dice "QR" \| playable "R" \| legal 1/);
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
  send('enter');
  assert.match(second.state(), /overlay none \| turn 1 \| phase roll/);
});

test('a damaged ledger is kept aside, not written over by the next result', () => {
  reset();
  // A ledger this build cannot read, as a later build's schema would be.
  const damaged = JSON.stringify({ schema: 2, lastCountedId: 'old' });
  new MMKV().set('dicechess-tv.ledger.v1', damaged);

  // Start a hotseat game, roll, then resign through the menu.
  enter(launch());
  send('enter', 'back', 'down', 'select', 'down', 'select');

  // The result starts a new record, and the one that no longer reads is still
  // there, unchanged, beside it.
  const ledger = new MmkvSnapshotStore<Ledger>({
    key: 'dicechess-tv.ledger.v1',
    decode: decodeLedger,
  }).read();
  assert.deepEqual(ledger?.hotseat, { white: 0, draws: 0, black: 1 });
  assert.equal(new MMKV().getString('dicechess-tv.ledger.v1.damaged'), damaged);

  // A relaunch reads the new record, and leaves the kept copy alone.
  launch();
  assert.equal(new MMKV().getString('dicechess-tv.ledger.v1.damaged'), damaged);
});

test('a damaged ledger that cannot be kept aside neither stops the app nor is saved over', () => {
  reset();
  const damaged = JSON.stringify({ schema: 2, lastCountedId: 'old' });
  new MMKV().set('dicechess-tv.ledger.v1', damaged);
  // Storage refuses the copy, as a full disk would.
  const set = MMKV.prototype.set;
  MMKV.prototype.set = function (key: string, value: string) {
    if (key === 'dicechess-tv.ledger.v1.damaged') throw new Error('No space');
    set.call(this, key, value);
  };
  try {
    const launched = enter(launch());
    assert.match(launched.state(), /overlay none \| turn 1 \| phase roll/);
    send('enter', 'back', 'down', 'select', 'down', 'select');
    // Without its copy, the damaged ledger is not saved over.
    assert.equal(new MMKV().getString('dicechess-tv.ledger.v1'), damaged);
  } finally {
    MMKV.prototype.set = set;
  }

  // Once the copy can be made, the finished game is counted on the next launch.
  launch();
  assert.equal(new MMKV().getString('dicechess-tv.ledger.v1.damaged'), damaged);
  const ledger = new MmkvSnapshotStore<Ledger>({
    key: 'dicechess-tv.ledger.v1',
    decode: decodeLedger,
  }).read();
  assert.deepEqual(ledger?.hotseat, { white: 0, draws: 0, black: 1 });
});

test('a ledger that storage cannot read does not stop the app', () => {
  reset();
  const getString = MMKV.prototype.getString;
  MMKV.prototype.getString = function (key: string) {
    if (key === 'dicechess-tv.ledger.v1') throw new Error('I/O error');
    return getString.call(this, key);
  };
  try {
    assert.match(launch().state(), /overlay home/);
  } finally {
    MMKV.prototype.getString = getString;
  }
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

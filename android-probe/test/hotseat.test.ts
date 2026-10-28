import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { after, test } from 'node:test';
import { buildSync } from 'esbuild';
import { newGame, rollGame, viewGame } from '../../src/core/game.ts';
import type { ScreenOptions } from '../../native/src/screen.ts';
import type { BoardKey } from '../../src/core/boardInput.ts';

// Bundle the real shared reducer, just as Metro does, without RN or test stubs.
const directory = mkdtempSync(join(tmpdir(), 'android-hotseat-'));
after(() => rmSync(directory, { recursive: true, force: true }));
const bundle = buildSync({
  stdin: {
    contents:
      "export * from './src/hotseat'; export * from './src/androidRemote';",
    resolveDir: resolve('.'),
  },
  bundle: true,
  platform: 'node',
  format: 'esm',
  write: false,
});
const path = join(directory, 'session.mjs');
writeFileSync(path, bundle.outputFiles[0].text);
const {
  createHotseatSession,
  hotseatMenu,
  HOTSEAT_KEY,
  androidDirection,
  pulseKey,
} = (await import(
  pathToFileURL(path).href
)) as typeof import('../src/hotseat.ts') &
  typeof import('../src/androidRemote.ts');
const options = (roll = [1, 1, 1]): ScreenOptions => {
  let id = 0;
  return {
    roll: () => roll,
    newId: () => `test-${++id}`,
    side: () => 'w',
    schedule: () => undefined,
  };
};
function memory(raw?: string) {
  const values = new Map<string, string>();
  if (raw !== undefined) values.set(HOTSEAT_KEY, raw);
  let writes = 0;
  return {
    values,
    get writes() {
      return writes;
    },
    getString: (key: string) => values.get(key),
    set: (key: string, value: string) => {
      writes++;
      values.set(key, value);
    },
    delete: (key: string) => {
      values.delete(key);
    },
  };
}
const key = (
  session: ReturnType<typeof createHotseatSession>,
  name: BoardKey,
) => session.dispatch({ kind: 'key', key: name });

test('a partial hotseat turn survives a new session exactly; focus changes do not write', () => {
  const store = memory();
  const session = createHotseatSession(store, options());
  key(session, 'select'); // roll
  assert.equal(store.writes, 2);
  key(session, 'select'); // select a pawn
  key(session, 'right');
  assert.equal(store.writes, 2);
  key(session, 'select'); // commit a legal move
  const game = session.getState().game;
  assert.equal(game.moves.length, 1);
  assert.equal(game.phase, 'move');
  assert.deepEqual(game.roll, [1, 1, 1]);
  const restored = createHotseatSession(store, options());
  assert.deepEqual(restored.getState().game, game);
  assert.equal(viewGame(restored.getState().game).remaining, 'PP');
  assert.equal(store.writes, 3);
});

test('three pawn actions hand off to Black through the shared reducer', () => {
  const session = createHotseatSession(memory(), options());
  key(session, 'select');
  for (let i = 0; i < 3; i++) {
    key(session, 'select');
    key(session, 'select');
  }
  assert.equal(session.getState().game.phase, 'handoff');
  key(session, 'select');
  assert.equal(viewGame(session.getState().game).side, 'b');
  assert.equal(session.getState().game.turn, 2);
  assert.equal(session.getState().game.mode, 'hotseat');
});

test('Back cancels a selected piece before opening the limited menu; replacement needs confirmation', () => {
  const session = createHotseatSession(memory(), options());
  key(session, 'select');
  key(session, 'select');
  key(session, 'back');
  assert.equal(session.getState().focus.selected, null);
  assert.equal(session.getState().overlay.kind, 'none');
  key(session, 'back');
  assert.deepEqual(
    hotseatMenu(session.getState().game).map((item) => item.id),
    ['resume', 'resign', 'draw', 'new-game', 'main-menu'],
  );
  const saved = session.getState().game;
  key(session, 'down');
  key(session, 'down');
  key(session, 'down');
  key(session, 'select');
  assert.equal(session.getState().overlay.kind, 'confirm');
  key(session, 'select'); // Cancel is first.
  assert.equal(session.getState().game, saved);
  key(session, 'down');
  key(session, 'down');
  key(session, 'down');
  key(session, 'select');
  key(session, 'down');
  key(session, 'select');
  assert.notEqual(session.getState().game.id, saved.id);
  assert.equal(session.getState().game.phase, 'roll');
});

test('empty rolls keep the shared OK guard and then pass the turn', () => {
  const session = createHotseatSession(memory(), options([6, 6, 6]));
  key(session, 'select');
  assert.equal(session.getState().guarded, true);
  const game = session.getState().game;
  key(session, 'select');
  assert.equal(session.getState().game, game);
  session.dispatch({ kind: 'unguard' });
  key(session, 'select');
  assert.equal(session.getState().game.turn, 2);
});

test('promotion and resignation use the shared game rules and confirmation', () => {
  const game = rollGame(
    newGame('hotseat', 'promotion', '7k/P7/8/8/8/8/8/7K w - - 0 1'),
    [1, 1, 1],
  );
  const session = createHotseatSession(memory(JSON.stringify(game)), options());
  key(session, 'select');
  key(session, 'select');
  assert.equal(session.getState().overlay.kind, 'promotion');
  key(session, 'select');
  assert.equal(session.getState().game.lastMove, 'a7a8q');
  key(session, 'back');
  key(session, 'down');
  key(session, 'select');
  key(session, 'down');
  key(session, 'select');
  assert.equal(session.getState().game.result?.reason, 'resigned');
  key(session, 'select');
  assert.deepEqual(
    hotseatMenu(session.getState().game).map((item) => item.id),
    ['new-game', 'main-menu'],
  );
  key(session, 'down');
  key(session, 'select');
  assert.equal(session.getState().overlay.kind, 'home');
});

test('canceling replacement after a result restores a visible menu choice', () => {
  const session = createHotseatSession(memory(), options());
  key(session, 'back');
  key(session, 'down');
  key(session, 'down');
  key(session, 'select'); // Agree a draw.
  assert.equal(session.getState().game.result?.reason, 'agreed-draw');
  key(session, 'select');
  key(session, 'select'); // New game confirmation.
  key(session, 'select'); // Cancel.
  assert.deepEqual(session.getState().overlay, { kind: 'menu', index: 3 });
  key(session, 'select');
  key(session, 'back');
  assert.deepEqual(session.getState().overlay, { kind: 'menu', index: 3 });
});

test('corrupt and non-hotseat saves are preserved and reported', () => {
  for (const raw of ['broken', JSON.stringify(newGame('random', 'bot'))]) {
    const store = memory(raw);
    assert.throws(() => createHotseatSession(store, options()));
    assert.equal(store.getString(HOTSEAT_KEY), raw);
    assert.equal(store.writes, 0);
  }
});

test('a storage failure cannot advance the visible game or overwrite its last snapshot', () => {
  const store = memory();
  const session = createHotseatSession(store, options());
  const state = session.getState();
  const saved = store.getString(HOTSEAT_KEY);
  store.set = () => {
    throw new Error('storage unavailable');
  };
  assert.throws(() => key(session, 'select'), /storage unavailable/);
  assert.equal(session.getState(), state);
  assert.equal(store.getString(HOTSEAT_KEY), saved);
});

test('Android directions produce one completed key and TV select cannot duplicate Pressable', () => {
  for (const direction of ['up', 'down', 'left', 'right']) {
    assert.equal(
      androidDirection({ eventType: direction, eventKeyAction: 0 }),
      null,
    );
    assert.equal(
      androidDirection({ eventType: direction, eventKeyAction: 1 }),
      direction,
    );
  }
  for (const eventType of ['select', 'longSelect', 'back', 'focus', 'unknown'])
    assert.equal(androidDirection({ eventType, eventKeyAction: 1 }), null);
  assert.equal(androidDirection({ eventType: 'right' }), null);
  const events: unknown[] = [];
  pulseKey((event) => events.push(event), 'select');
  assert.deepEqual(events, [
    { key: 'select', phase: 'down' },
    { key: 'select', phase: 'up' },
  ]);
});

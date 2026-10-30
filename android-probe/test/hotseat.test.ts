import { openOptionalEffects } from '../src/effects.ts';
import { readAndroidSound } from '../src/soundPreferences.ts';
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
      "export * from './src/gameSession'; export * from './src/androidRemote';",
    resolveDir: resolve('.'),
  },
  bundle: true,
  platform: 'node',
  format: 'esm',
  write: false,
});
const path = join(directory, 'session.mjs');
writeFileSync(path, bundle.outputFiles[0].text);
const { createGameSession, gameMenu, GAME_KEY, androidDirection, pulseKey } =
  (await import(
    pathToFileURL(path).href
  )) as typeof import('../src/gameSession.ts') &
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
  if (raw !== undefined) values.set(GAME_KEY, raw);
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
const key = (session: ReturnType<typeof createGameSession>, name: BoardKey) =>
  session.dispatch({ kind: 'key', key: name });

test('a partial hotseat turn survives a new session exactly; focus changes do not write', () => {
  const store = memory();
  const session = createGameSession(store, options());
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
  const restored = createGameSession(store, options());
  assert.deepEqual(restored.getState().game, game);
  assert.equal(viewGame(restored.getState().game).remaining, 'PP');
  assert.equal(store.writes, 3);
});

test('three pawn actions hand off to Black through the shared reducer', () => {
  const session = createGameSession(memory(), options());
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
  const session = createGameSession(memory(), options());
  key(session, 'select');
  key(session, 'select');
  key(session, 'back');
  assert.equal(session.getState().focus.selected, null);
  assert.equal(session.getState().overlay.kind, 'none');
  key(session, 'back');
  assert.deepEqual(
    gameMenu(session.getState().game).map((item) => item.id),
    ['resume', 'resign', 'draw', 'new-game', 'main-menu', 'rules'],
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
  const session = createGameSession(memory(), options([6, 6, 6]));
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
  const session = createGameSession(memory(JSON.stringify(game)), options());
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
  assert.equal(session.getState().overlay.kind, 'home');
});

test('a finished hotseat game returns home with OK or Back, like Vega', () => {
  for (const exit of ['select', 'back'] as const) {
    const session = createGameSession(memory(), options());
    key(session, 'back');
    key(session, 'down');
    key(session, 'down');
    key(session, 'select');
    assert.equal(session.getState().game.result?.reason, 'agreed-draw');
    const ended = session.getState().game;
    key(session, exit);
    assert.equal(session.getState().overlay.kind, 'home');
    assert.equal(session.getState().game, ended);
  }
});

test('corrupt current saves are preserved and reported', () => {
  const store = memory('broken');
  assert.throws(() => createGameSession(store, options()));
  assert.equal(store.getString(GAME_KEY), 'broken');
  assert.equal(store.writes, 0);
});

test('a storage failure cannot advance the visible game or overwrite its last snapshot', () => {
  const store = memory();
  const session = createGameSession(store, options());
  const state = session.getState();
  const saved = store.getString(GAME_KEY);
  store.set = () => {
    throw new Error('storage unavailable');
  };
  assert.throws(() => key(session, 'select'), /storage unavailable/);
  assert.equal(session.getState(), state);
  assert.equal(store.getString(GAME_KEY), saved);
});

test('androidDirection accepts completed direction releases and pulseKey emits select phases', () => {
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

test('rules from either game mode return to their menu row without changing the saved turn', () => {
  for (const mode of ['hotseat', 'greedy'] as const) {
    const game = rollGame(newGame(mode, 'rules'), [1, 1, 1]);
    const store = memory(JSON.stringify(game));
    const session = createGameSession(store, options());
    key(session, 'back');
    key(session, 'up'); // Last supported entry, using the shared menu index.
    const menu = session.getState().overlay;
    assert.deepEqual(menu, { kind: 'menu', index: mode === 'hotseat' ? 5 : 4 });
    key(session, 'select');
    assert.deepEqual(session.getState().overlay, {
      kind: 'rules',
      from: 'menu',
    });
    assert.deepEqual(session.getState().game, game);
    key(session, 'back');
    assert.deepEqual(session.getState().overlay, menu);
    key(session, 'back');
    assert.equal(session.getState().overlay.kind, 'none');
    assert.deepEqual(session.getState().game, game);
    assert.equal(store.writes, 0);
  }
});

test('optional sound failure leaves a saved game playable and commits its next move', () => {
  for (const failure of ['read', 'parse']) {
    const store = memory();
    const session = createGameSession(store, options());
    key(session, 'select');
    const saved = session.getState().game;
    const restored = createGameSession(store, options());
    const reports: unknown[] = [];
    const effects = openOptionalEffects(
      () => {
        readAndroidSound({
          ...store,
          getString() {
            if (failure === 'read') throw new Error('settings unavailable');
            return '{';
          },
        });
        throw new Error('Unexpected successful read');
      },
      (error) => reports.push(error),
    );
    assert.equal(effects, null);
    assert.equal(reports.length, 1);
    assert.deepEqual(restored.getState().game, saved);
    key(restored, 'select');
    key(restored, 'select');
    assert.equal(restored.getState().game.revision, saved.revision + 1);
    assert.deepEqual(
      createGameSession(store, options()).getState().game,
      restored.getState().game,
    );
  }
});

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildSync } from 'esbuild';
import { resolve } from 'node:path';
import { newGame, rollGame, moveGame } from '../../src/core/game.ts';
import type { BoardKey } from '../../src/core/boardInput.ts';
const bundle = buildSync({
  stdin: {
    contents:
      "export * from './src/gameSession'; export * from './src/screenPreferences';",
    resolveDir: resolve('.'),
  },
  bundle: true,
  platform: 'node',
  format: 'esm',
  write: false,
});
const { createGameSession, readScreenPreferences, saveScreenPreferences } =
  (await import(
    'data:text/javascript;base64,' +
      Buffer.from(bundle.outputFiles[0].text).toString('base64')
  )) as typeof import('../src/gameSession.ts') &
    typeof import('../src/screenPreferences.ts');

/** Keep game and preference writes observable in separate stores. */
function store(initial?: string) {
  const values = new Map<string, string>();
  if (initial) values.set('game.v1', initial);
  const writes: string[] = [];
  return {
    values,
    writes,
    getString: (key: string) => values.get(key),
    set(key: string, value: string) {
      writes.push(key);
      values.set(key, value);
    },
    delete() {
      throw new Error('Unexpected deletion');
    },
  };
}
/** Restore a real partially played turn, then use the same reducer and storage port as Android. */
function rig(mode: 'hotseat' | 'random' = 'hotseat') {
  const game = moveGame(
    rollGame(
      newGame(mode, 'saved-turn', undefined, mode === 'random' ? 'w' : null),
      [1, 1, 1],
    ),
    'e2e3',
  );
  const raw = JSON.stringify(game);
  const games = store(raw);
  const preferences = store();
  const options = {
    roll: () => [1, 1, 1],
    newId: () => 'new',
    side: () => 'w' as const,
    schedule() {},
  };
  const session = createGameSession(
    games,
    options,
    mode === 'hotseat' ? 'hotseat' : 'bot',
    'continue',
    {},
    {
      read: () => readScreenPreferences(preferences),
      save: (next, before) => saveScreenPreferences(preferences, next, before),
    },
  );
  const key = (...keys: BoardKey[]) => {
    for (const key of keys) session.dispatch({ kind: 'key', key });
  };
  return { games, preferences, session, key, raw };
}

test('all eight in-game settings persist before publication and retain exact friend/bot partial turns', () => {
  for (const mode of ['hotseat', 'random'] as const) {
    const h = rig(mode);
    const game = h.session.getState().game;
    h.key('back', 'up', 'select');
    assert.deepEqual(h.session.getState().overlay, {
      kind: 'settings',
      index: 0,
      from: 'menu',
    });
    assert.equal(
      h.preferences.writes.length,
      0,
      'opening only reads preferences',
    );
    h.key('select'); // Music off
    h.key('down', 'select'); // Sounds off
    h.key('down', 'left'); // Voices 9
    h.key('down', 'right'); // Highlights enhanced
    h.key('down', 'right'); // Auto-play on
    h.key('down', 'right', 'right'); // Play as Black
    h.key('down', 'right'); // Turn board on
    h.key('down', 'right'); // Host Rolly
    const saved = readScreenPreferences(h.preferences);
    assert.deepEqual(saved.music, { on: false, volume: 7 });
    assert.deepEqual(saved.sound, { on: false, volume: 10 });
    assert.deepEqual(saved.voices, { on: true, volume: 9 });
    assert.equal(saved.highlights, 'enhanced');
    assert.equal(saved.autoSelect, true);
    assert.equal(saved.playAs, 'b');
    assert.equal(saved.turnHotseat, true);
    assert.equal(saved.host, 'rolly');
    assert.equal(h.session.getState().game, game);
    assert.equal(
      h.session.getState().game.human,
      mode === 'random' ? 'w' : null,
    );
    h.key('back');
    assert.deepEqual(h.session.getState().overlay, {
      kind: 'menu',
      index: mode === 'hotseat' ? 6 : 5,
    });
    h.key('back');
    assert.equal(h.session.getState().overlay.kind, 'none');
    assert.equal(h.session.getState().game, game);
    assert.equal(h.games.values.get('game.v1'), h.raw);
    assert.deepEqual(h.games.writes, []);
    h.key('back', 'up', 'select');
    assert.deepEqual(h.session.getState().music, saved.music);
  }
});

test('preference read/write failures preserve the previous screen and exact saved game', () => {
  const h = rig();
  h.key('back', 'up');
  h.preferences.values.set('voices.v1', '{broken');
  const menu = h.session.getState();
  assert.throws(() => h.key('select'));
  assert.equal(h.session.getState(), menu);
  h.preferences.values.delete('voices.v1');
  h.key('select');
  const settings = h.session.getState();
  h.preferences.set = () => {
    throw new Error('disk');
  };
  assert.throws(() => h.key('select'), /disk/);
  assert.equal(h.session.getState(), settings);
  assert.equal(h.preferences.values.get('music.v1'), undefined);
  assert.equal(h.games.values.get('game.v1'), h.raw);
  assert.deepEqual(h.games.writes, []);
});

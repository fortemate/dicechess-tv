import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildSync } from 'esbuild';
import { newGame, rollGame, resignGame } from '../../src/core/game.ts';
import type { ScreenOptions } from '../../native/src/screen.ts';
import type { BoardKey } from '../../src/core/boardInput.ts';
const dir = mkdtempSync(join(tmpdir(), 'android-home-'));
after(() => rmSync(dir, { recursive: true, force: true }));
const bundle = buildSync({
  stdin: {
    contents:
      "export * from './src/gameSession'; export * from './src/homeMenu';",
    resolveDir: resolve('.'),
  },
  bundle: true,
  platform: 'node',
  format: 'esm',
  write: false,
});
const path = join(dir, 'home.mjs');
writeFileSync(path, bundle.outputFiles[0].text);
const { createGameSession, readSavedGame, homeItems, gameStoreId } =
  (await import(
    pathToFileURL(path).href
  )) as typeof import('../src/gameSession.ts') &
    typeof import('../src/homeMenu.ts');
let ids = 0;
const options: ScreenOptions = {
  roll: () => [1, 1, 1],
  side: () => 'b',
  newId: () => `home-${++ids}`,
  schedule: () => {},
};
function memory(raw?: string) {
  let saved = raw,
    writes = 0;
  return {
    getString: () => saved,
    set: (_key: string, value: string) => {
      saved = value;
      writes++;
    },
    delete: () => {
      throw new Error('Unexpected deletion');
    },
    writes: () => writes,
  };
}
const keys = (
  session: ReturnType<typeof createGameSession>,
  ...input: BoardKey[]
) => {
  for (const key of input) session.dispatch({ kind: 'key', key });
};

test('fresh home has only new-game/diagnostic entries and reads both slots without writing', () => {
  const store = memory();
  const read: string[] = [];
  const items = homeItems((mode) => {
    read.push(mode);
    return readSavedGame(store, mode);
  });
  assert.deepEqual(read, ['bot', 'hotseat']);
  assert.deepEqual(
    items.map((i) => i.id),
    ['new-bot', 'new-hotseat', 'diagnostics'],
  );
  assert.equal(store.writes(), 0);
  assert.notEqual(gameStoreId('bot'), gameStoreId('hotseat'));
});

test('home exposes both exact saved games with the current opponent and resolved side', () => {
  const bot = newGame('aggressive', 'bot', undefined, 'b', 'random');
  const friend = rollGame(newGame('hotseat', 'friend'), [1, 1, 1]);
  const stores = {
    bot: memory(JSON.stringify(bot)),
    hotseat: memory(JSON.stringify(friend)),
  };
  const items = homeItems((mode) => readSavedGame(stores[mode], mode));
  assert.equal(items[0].label, 'Continue vs Rampage');
  assert.match(items[0].description, /You: Black/);
  assert.equal(items[1].label, 'Continue with a friend');
  for (const mode of ['bot', 'hotseat'] as const) {
    const session = createGameSession(stores[mode], options, mode, 'continue');
    assert.deepEqual(session.getState().game, mode === 'bot' ? bot : friend);
    assert.equal(session.getState().overlay.kind, 'none');
    assert.equal(stores[mode].writes(), 0);
  }
});

test('a corrupt slot stays reachable, preserves bytes and does not hide the other save', () => {
  const stores = {
    bot: memory('damaged'),
    hotseat: memory(JSON.stringify(newGame('hotseat', 'friend'))),
  };
  const items = homeItems((mode) => readSavedGame(stores[mode], mode));
  assert.equal(items[0].label, 'Open saved computer game');
  assert.equal(items[1].label, 'Continue with a friend');
  for (const intent of ['continue', 'new'] as const)
    assert.throws(() => createGameSession(stores.bot, options, 'bot', intent));
  assert.equal(stores.bot.getString(), 'damaged');
  assert.equal(stores.bot.writes(), 0);
});

test('New friend game preserves the live save until Yes; Cancel returns home', () => {
  const old = rollGame(newGame('hotseat', 'old'), [1, 1, 1]);
  const store = memory(JSON.stringify(old));
  const session = createGameSession(store, options, 'hotseat', 'new');
  assert.equal(session.getState().overlay.kind, 'confirm');
  assert.equal(store.writes(), 0);
  keys(session, 'select');
  assert.equal(session.getState().overlay.kind, 'home');
  assert.deepEqual(readSavedGame(store, 'hotseat'), old);
  const confirmed = createGameSession(store, options, 'hotseat', 'new');
  keys(confirmed, 'down', 'select');
  assert.notEqual(confirmed.getState().game.id, old.id);
  assert.equal(confirmed.getState().game.phase, 'roll');
  assert.equal(store.writes(), 1);
});

test('New bot game opens the current opponent; Back/cancel preserve it and Yes draws once', () => {
  const old = newGame('aggressive', 'old', undefined, 'b');
  const store = memory(JSON.stringify(old));
  let draws = 0;
  const opts = {
    ...options,
    side: () => {
      draws++;
      return 'w' as const;
    },
  };
  const session = createGameSession(store, opts, 'bot', 'new');
  assert.deepEqual(session.getState().overlay, {
    kind: 'opponent',
    index: 2,
    from: 'home',
  });
  keys(session, 'back');
  assert.equal(session.getState().overlay.kind, 'home');
  assert.equal(store.writes(), 0);
  const canceled = createGameSession(store, opts, 'bot', 'new');
  keys(canceled, 'select', 'select', 'select');
  assert.equal(canceled.getState().overlay.kind, 'home');
  assert.deepEqual(readSavedGame(store, 'bot'), old);
  assert.equal(draws, 0);
  const confirmed = createGameSession(store, opts, 'bot', 'new');
  keys(confirmed, 'select', 'select', 'down', 'select');
  assert.equal(draws, 1);
  assert.equal(confirmed.getState().game.colour, 'random');
  assert.equal(confirmed.getState().game.human, 'w');
  assert.equal(store.writes(), 1);
});

test('ended games are labeled as results; new hotseat commits immediately and bot still chooses', () => {
  for (const mode of ['bot', 'hotseat'] as const) {
    const ended = resignGame(
      newGame(mode === 'bot' ? 'greedy' : 'hotseat', 'ended'),
    );
    const store = memory(JSON.stringify(ended));
    assert.match(
      homeItems((m) => (m === mode ? ended : null))[0].label,
      /^View result/,
    );
    const session = createGameSession(store, options, mode, 'new');
    if (mode === 'bot') {
      assert.equal(session.getState().overlay.kind, 'opponent');
      assert.equal(store.writes(), 0);
      keys(session, 'select', 'select');
    }
    assert.equal(session.getState().overlay.kind, 'none');
    assert.equal(session.getState().game.phase, 'roll');
    assert.equal(store.writes(), 1);
  }
});

test('fresh bot selection never writes a preview; a fresh friend game writes exactly once', () => {
  const bot = memory();
  keys(createGameSession(bot, options, 'bot', 'new'), 'back');
  assert.equal(bot.getString(), undefined);
  const friend = memory();
  const session = createGameSession(friend, options, 'hotseat', 'new');
  assert.equal(friend.writes(), 1);
  assert.deepEqual(readSavedGame(friend, 'hotseat'), session.getState().game);
});

test('failed replacement of an ended game preserves the existing snapshot', () => {
  const old = JSON.stringify(resignGame(newGame('hotseat', 'ended')));
  const store = memory(old);
  store.set = () => {
    throw new Error('disk full');
  };
  assert.throws(
    () => createGameSession(store, options, 'hotseat', 'new'),
    /disk full/,
  );
  assert.equal(store.getString(), old);
});

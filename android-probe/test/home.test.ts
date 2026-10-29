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
const {
  createGameSession,
  readSavedGame,
  homeItems,
  legacyGames,
  migrateGame,
} = (await import(
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

test('home uses Vega labels/order, one Resume game, no diagnostic or unsupported entries', () => {
  assert.deepEqual(
    homeItems(null).map(({ id, label }) => [id, label]),
    [
      ['hotseat', 'Play a friend'],
      ['computer', 'Play the computer'],
      ['learn', 'Learn to play'],
      ['rules', 'Rules reference'],
      ['about', 'About'],
    ],
  );
  for (const mode of ['hotseat', 'random', 'greedy', 'aggressive'] as const) {
    const game = newGame(mode, 'current');
    const items = homeItems(game);
    assert.deepEqual(
      items.map((i) => i.id),
      ['resume', 'hotseat', 'computer', 'learn', 'rules', 'about'],
    );
    assert.equal(items[0].label, 'Resume game');
    assert.equal(items[0].action.kind, 'game');
    if (items[0].action.kind !== 'game')
      throw new Error('Expected a game action');
    assert.equal(items[0].action.intent, 'continue');
    assert.equal(items[0].action.mode, mode === 'hotseat' ? 'hotseat' : 'bot');
    assert.deepEqual(
      homeItems(resignGame(game)).map((i) => i.id),
      ['hotseat', 'computer', 'learn', 'rules', 'about'],
    );
  }
  assert.equal(homeItems(null, true)[0].id, 'resume');
  assert.deepEqual(homeItems(null).find((i) => i.id === 'about')?.action, {
    kind: 'about',
  });
  assert.deepEqual(homeItems(null).find((i) => i.id === 'learn')?.action, {
    kind: 'tutorial',
  });
});

const tutorialChoices = [
  { mode: 'random', colour: 'w' },
  { mode: 'hotseat', colour: 'random' },
] as const;

test('tutorial closing choices start the named game without selectors on a fresh or ended save', () => {
  for (const old of [undefined, resignGame(newGame('greedy', 'ended'))]) {
    for (const choice of tutorialChoices) {
      const store = memory(old && JSON.stringify(old));
      const session = createGameSession(store, options, 'hotseat', {
        kind: 'tutorial',
        choice,
      });
      const { game, overlay } = session.getState();
      assert.equal(game.mode, choice.mode);
      assert.equal(game.human, choice.mode === 'random' ? 'w' : null);
      assert.equal(game.phase, 'roll');
      assert.equal(overlay.kind, 'none');
      assert.deepEqual(readSavedGame(store), game);
      assert.equal(store.writes(), 1);
    }
  }
});

test('tutorial closing choices protect either current game until explicit confirmation', () => {
  for (const old of [
    rollGame(newGame('hotseat', 'friend'), [1, 1, 1]),
    rollGame(newGame('aggressive', 'bot', undefined, 'b', 'random'), [1, 1, 1]),
  ]) {
    const raw = JSON.stringify(old);
    for (const choice of tutorialChoices) {
      for (const cancel of ['select', 'back'] as const) {
        const store = memory(raw);
        const session = createGameSession(store, options, 'hotseat', {
          kind: 'tutorial',
          choice,
        });
        assert.equal(session.getState().overlay.kind, 'confirm');
        assert.deepEqual(session.getState().game, old);
        assert.equal(store.writes(), 0);
        keys(session, cancel);
        assert.equal(session.getState().overlay.kind, 'home');
        assert.equal(store.getString(), raw);
        assert.equal(store.writes(), 0);
      }
      const store = memory(raw);
      const session = createGameSession(store, options, 'hotseat', {
        kind: 'tutorial',
        choice,
      });
      keys(session, 'down', 'select');
      const { game, overlay } = session.getState();
      assert.equal(overlay.kind, 'none');
      assert.equal(game.mode, choice.mode);
      assert.equal(game.human, choice.mode === 'random' ? 'w' : null);
      assert.notEqual(game.id, old.id);
      assert.deepEqual(readSavedGame(store), game);
      assert.equal(store.writes(), 1);
    }
  }
});

test('tutorial replacement never clears corrupt data or publishes a failed save', () => {
  const corrupt = memory('unreadable');
  assert.throws(() =>
    createGameSession(corrupt, options, 'bot', {
      kind: 'tutorial',
      choice: tutorialChoices[0],
    }),
  );
  assert.equal(corrupt.getString(), 'unreadable');
  assert.equal(corrupt.writes(), 0);
  const old = JSON.stringify(rollGame(newGame('hotseat', 'old'), [1, 1, 1]));
  const store = memory(old);
  const session = createGameSession(store, options, 'bot', {
    kind: 'tutorial',
    choice: tutorialChoices[0],
  });
  store.set = () => {
    throw new Error('disk full');
  };
  keys(session, 'down');
  const before = session.getState();
  assert.throws(() => keys(session, 'select'), /disk full/);
  assert.equal(session.getState(), before);
  assert.equal(store.getString(), old);
  assert.equal(store.writes(), 0);
});

test('one current slot resumes either mode exactly without writes', () => {
  for (const game of [
    rollGame(newGame('hotseat', 'friend'), [1, 1, 1]),
    newGame('aggressive', 'bot', undefined, 'b', 'random'),
  ]) {
    const store = memory(JSON.stringify(game));
    const session = createGameSession(store, options);
    assert.deepEqual(session.getState().game, game);
    assert.equal(store.writes(), 0);
  }
});

test('cross-mode replacement keeps the current turn on Cancel, writes only on Yes', () => {
  for (const old of [
    rollGame(newGame('hotseat', 'friend'), [1, 1, 1]),
    newGame('aggressive', 'bot', undefined, 'b'),
  ]) {
    const mode = old.mode === 'hotseat' ? 'bot' : 'hotseat';
    const store = memory(JSON.stringify(old));
    const canceled = createGameSession(store, options, mode, 'new');
    if (mode === 'bot') keys(canceled, 'select', 'select');
    assert.equal(canceled.getState().overlay.kind, 'confirm');
    keys(canceled, 'select');
    assert.equal(canceled.getState().overlay.kind, 'home');
    assert.deepEqual(readSavedGame(store), old);
    assert.equal(store.writes(), 0);
    const confirmed = createGameSession(store, options, mode, 'new');
    if (mode === 'bot') keys(confirmed, 'select', 'select');
    keys(confirmed, 'down', 'select');
    assert.equal(
      confirmed.getState().game.mode,
      mode === 'bot' ? 'random' : 'hotseat',
    );
    assert.equal(confirmed.getState().overlay.kind, 'none');
    assert.equal(store.writes(), 1);
  }
});

test('Back through computer choices preserves a friend game and draws no random side', () => {
  const old = newGame('hotseat', 'friend');
  const store = memory(JSON.stringify(old));
  const session = createGameSession(
    store,
    {
      ...options,
      side: () => {
        throw new Error('Premature draw');
      },
    },
    'bot',
    'new',
  );
  keys(session, 'down', 'select', 'back', 'back');
  assert.equal(session.getState().overlay.kind, 'home');
  assert.deepEqual(readSavedGame(store), old);
  assert.equal(store.writes(), 0);
});

test('bot result rematch preserves opponent and color choice, rerolling Random once', () => {
  for (const colour of ['random', 'w', 'b'] as const) {
    const old = resignGame(
      newGame(
        'aggressive',
        'ended',
        undefined,
        colour === 'w' ? 'w' : 'b',
        colour,
      ),
    );
    const store = memory(JSON.stringify(old));
    let draws = 0;
    const session = createGameSession(store, {
      ...options,
      side: () => {
        draws++;
        return 'w';
      },
    });
    assert.equal(session.getState().overlay.kind, 'result');
    keys(session, 'select');
    const game = session.getState().game;
    assert.equal(game.mode, 'aggressive');
    assert.equal(game.colour, colour);
    assert.equal(game.human, colour === 'random' ? 'w' : colour);
    assert.equal(draws, colour === 'random' ? 1 : 0);
    assert.equal(game.phase, 'roll');
    assert.equal(session.getState().overlay.kind, 'none');
    assert.equal(store.writes(), 1);
  }
});

test('ended games start directly, while a canceled fresh computer preview writes nothing', () => {
  for (const mode of ['bot', 'hotseat'] as const) {
    const old = resignGame(newGame('random', 'ended'));
    const store = memory(JSON.stringify(old));
    const session = createGameSession(store, options, mode, 'new');
    if (mode === 'bot') keys(session, 'select', 'select');
    assert.equal(session.getState().overlay.kind, 'none');
    assert.equal(store.writes(), 1);
  }
  const store = memory();
  keys(createGameSession(store, options, 'bot', 'new'), 'back');
  assert.equal(store.writes(), 0);
});

test('failed cross-mode replacement and rematch preserve state and the previous snapshot', () => {
  for (const ended of [false, true]) {
    const initial = newGame('aggressive', 'previous');
    const old = ended ? resignGame(initial) : initial;
    const store = memory(JSON.stringify(old));
    const session = createGameSession(
      store,
      options,
      'hotseat',
      ended ? 'continue' : 'new',
    );
    store.set = () => {
      throw new Error('disk full');
    };
    if (!ended) keys(session, 'down');
    const before = session.getState();
    assert.throws(() => keys(session, 'select'), /disk full/);
    assert.equal(session.getState(), before);
    assert.deepEqual(readSavedGame(store), old);
  }
});

test('migration copies either chosen exact partial turn; all legacy bytes remain untouched', () => {
  const originals = {
    hotseat: JSON.stringify(rollGame(newGame('hotseat', 'friend'), [1, 1, 1])),
    bot: JSON.stringify(
      rollGame(newGame('greedy', 'bot', undefined, 'b', 'random'), [1, 1, 1]),
    ),
  };
  const legacy = legacyGames((mode) => originals[mode]);
  assert.equal(legacy.length, 2);
  for (const choice of legacy) {
    const store = memory();
    assert.deepEqual(
      migrateGame(store, choice),
      JSON.parse(originals[choice.mode]),
    );
    assert.equal(store.getString(), originals[choice.mode]);
    assert.equal(store.writes(), 1);
    // Simulate restart/retry or a stale selection; a current snapshot always wins.
    assert.deepEqual(
      migrateGame(
        store,
        legacy.find((i) => i !== choice)!,
      ),
      choice.game,
    );
    assert.equal(store.writes(), 1);
    assert.deepEqual(
      legacyGames((mode) => originals[mode]),
      legacy,
    );
  }
});

test('migration keeps corrupt/wrong-mode saves reachable and never overwrites a current corrupt save', () => {
  for (const raw of [
    'damaged',
    JSON.stringify(newGame('hotseat', 'wrong-slot')),
  ]) {
    const [choice] = legacyGames((mode) => (mode === 'bot' ? raw : undefined));
    assert.ok(choice.error);
    const store = memory();
    assert.throws(() => migrateGame(store, choice));
    assert.equal(store.writes(), 0);
  }
  const [valid] = legacyGames((mode) =>
    mode === 'hotseat' ? JSON.stringify(newGame('hotseat', 'old')) : undefined,
  );
  const store = memory('damaged-current');
  assert.throws(() => migrateGame(store, valid));
  assert.equal(store.getString(), 'damaged-current');
  assert.equal(store.writes(), 0);
});

test('migration can retry after a write failure without deleting or mutating old data', () => {
  const raw = JSON.stringify(newGame('hotseat', 'old'));
  const [choice] = legacyGames((mode) =>
    mode === 'hotseat' ? raw : undefined,
  );
  const store = memory();
  const write = store.set;
  store.set = () => {
    throw new Error('disk full');
  };
  assert.throws(() => migrateGame(store, choice), /disk full/);
  assert.equal(store.getString(), undefined);
  assert.equal(choice.raw, raw);
  store.set = write;
  migrateGame(store, choice);
  assert.equal(store.getString(), raw);
});

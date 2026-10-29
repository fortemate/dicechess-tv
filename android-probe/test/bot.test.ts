import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildSync } from 'esbuild';
import { newGame, rollGame, viewGame, type Game } from '../../src/core/game.ts';
import { botReply, type BotReply } from '../../src/core/bot.ts';
import type { ScreenOptions } from '../../native/src/screen.ts';
const dir = mkdtempSync(join(tmpdir(), 'android-bot-'));
after(() => rmSync(dir, { recursive: true, force: true }));
const bundled = buildSync({
  stdin: {
    contents:
      "export {flipped} from '../native/src/screen'; export * from './src/gameSession'; export * from './src/botDriver'; export {createActivity} from '../native/src/activity';",
    resolveDir: resolve('.'),
  },
  bundle: true,
  // Shared activity imports React. Resolve the Android runtime explicitly,
  // as Metro does; CI deliberately does not install native/node_modules.
  alias: { react: resolve('node_modules/react') },
  platform: 'node',
  format: 'esm',
  write: false,
});
const file = join(dir, 'bot.mjs');
writeFileSync(file, bundled.outputFiles[0].text);
const { createGameSession, createBotDriver, createActivity, flipped } =
  (await import(
    pathToFileURL(file).href
  )) as typeof import('../src/gameSession.ts') &
    typeof import('../src/botDriver.ts') &
    typeof import('../../native/src/activity.ts') &
    Pick<typeof import('../../native/src/screen.ts'), 'flipped'>;
let ids = 0;
const options: ScreenOptions = {
  roll: () => [1, 1, 1],
  newId: () => `bot-${++ids}`,
  side: () => 'w',
  schedule: () => {},
  reply: () => {
    throw new Error('No RN search');
  },
};
function memory(raw?: string) {
  let saved = raw;
  return {
    getString: () => saved,
    set: (_key: string, value: string) => {
      saved = value;
    },
    delete: () => {
      saved = undefined;
    },
  };
}
const initialBot = () =>
  rollGame(
    newGame(
      'random',
      'bot',
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR b KQkq - 0 1',
      'w',
    ),
    [1, 1, 1],
  );
const tick = async () => {
  for (let i = 0; i < 6; i++) await Promise.resolve();
};
function harness(store = memory(JSON.stringify(initialBot()))) {
  const session = createGameSession(store, options, 'bot');
  const activity = createActivity(true);
  const jobs: { run: () => void; canceled: boolean }[] = [];
  const requests: {
    game: Game;
    resolve: (reply: BotReply) => void;
    reject: (error: Error) => void;
  }[] = [];
  const errors: unknown[] = [];
  let disposed = 0;
  const driver = createBotDriver({
    activity,
    read: session.getState,
    send: (action) => {
      session.dispatch(action);
    },
    fail: (e) => errors.push(e),
    report: () => {},
    worker: {
      request: (game) =>
        new Promise((resolve, reject) =>
          requests.push({ game, resolve, reject }),
        ),
      dispose: () => {
        disposed++;
      },
    },
    schedule: (run) => {
      const job = { run, canceled: false };
      jobs.push(job);
      return () => {
        job.canceled = true;
      };
    },
  });
  return {
    session,
    store,
    activity,
    driver,
    requests,
    errors,
    disposed: () => disposed,
    run() {
      const batch = jobs.splice(0);
      batch.filter((j) => !j.canceled).forEach((j) => j.run());
    },
  };
}

const keys = (
  session: ReturnType<typeof createGameSession>,
  ...input: ('up' | 'down' | 'left' | 'right' | 'select' | 'back')[]
) => {
  for (const key of input) session.dispatch({ kind: 'key', key });
};

test('first bot chooser can be canceled without saving a placeholder game', () => {
  const store = memory();
  const session = createGameSession(store, options, 'bot');
  assert.equal(session.hasSave(), false);
  assert.equal(session.getState().overlay.kind, 'opponent');
  keys(session, 'down', 'select');
  assert.deepEqual(session.getState().overlay, {
    kind: 'colour',
    index: 0,
    mode: 'greedy',
    from: 'home',
  });
  keys(session, 'back');
  assert.deepEqual(session.getState().overlay, {
    kind: 'opponent',
    index: 1,
    from: 'home',
  });
  keys(session, 'back');
  assert.equal(session.getState().overlay.kind, 'home');
  assert.equal(store.getString(), undefined);
});

test('all opponents and side choices start through the shared menus and restore exactly', () => {
  for (const [index, mode] of ['random', 'greedy', 'aggressive'].entries()) {
    for (const [choice, colour] of ['random', 'w', 'b'].entries()) {
      for (const randomSide of ['w', 'b'] as const) {
        let draws = 0;
        const opts = {
          ...options,
          side: () => {
            draws++;
            return randomSide;
          },
        };
        const store = memory();
        const session = createGameSession(store, opts, 'bot');
        for (let i = 0; i < index; i++) keys(session, 'down');
        keys(session, 'select');
        for (let i = 0; i < choice; i++) keys(session, 'down');
        assert.equal(store.getString(), undefined);
        keys(session, 'select');
        const { game, overlay } = session.getState();
        assert.equal(game.mode, mode);
        assert.equal(game.colour, colour);
        assert.equal(game.human, colour === 'random' ? randomSide : colour);
        assert.equal(flipped(game), game.human === 'b');
        assert.equal(overlay.kind, 'none');
        assert.equal(session.hasSave(), true);
        assert.deepEqual(JSON.parse(store.getString()!), game);
        assert.deepEqual(
          createGameSession(store, opts, 'bot').getState().game,
          game,
        );
        assert.equal(draws, colour === 'random' ? 1 : 0);
      }
    }
  }
});

test('replacement draws a random side only after confirmation; cancel preserves save and opponent', () => {
  let draws = 0;
  const store = memory(JSON.stringify(newGame('random', 'legacy')));
  const session = createGameSession(
    store,
    {
      ...options,
      side: () => {
        draws++;
        return 'b';
      },
    },
    'bot',
  );
  const old = session.getState().game;
  assert.equal(session.getState().overlay.kind, 'none');
  keys(session, 'back', 'down', 'down', 'select', 'down', 'select', 'select');
  assert.equal(session.getState().overlay.kind, 'confirm');
  assert.equal(draws, 0);
  keys(session, 'select'); // Cancel first.
  assert.equal(session.getState().game, old);
  assert.deepEqual(JSON.parse(store.getString()!), old);
  keys(
    session,
    'down',
    'down',
    'select',
    'down',
    'select',
    'select',
    'down',
    'select',
  );
  assert.equal(session.getState().game.mode, 'greedy');
  assert.equal(session.getState().game.human, 'b');
  assert.equal(draws, 1);
  assert.notEqual(session.getState().game.id, old.id);
});

test('a failed first save leaves the chooser open', () => {
  const store = memory();
  store.set = () => {
    throw new Error('disk full');
  };
  const session = createGameSession(store, options, 'bot');
  keys(session, 'select');
  const before = session.getState();
  assert.throws(() => keys(session, 'select'), /disk full/);
  assert.equal(session.getState(), before);
  assert.equal(session.hasSave(), false);
});

test('each opponent plays White first for a Black player and hands over the saved turn', async () => {
  for (const mode of ['random', 'greedy', 'aggressive'] as const) {
    const h = harness(
      memory(JSON.stringify(newGame(mode, 'black', undefined, 'b'))),
    );
    h.driver.update(h.session.getState());
    h.run();
    h.run(); // Roll White's dice after the presentation timer.
    assert.equal(viewGame(h.session.getState().game).side, 'w');
    h.driver.update(h.session.getState());
    await tick();
    assert.equal(h.requests.length, 1);
    assert.equal(h.requests[0].game.mode, mode);
    h.requests[0].resolve(botReply(h.requests[0].game));
    await tick();
    for (let step = 0; step < 8; step++) {
      h.run();
      await tick();
      h.run();
      h.driver.update(h.session.getState());
      await tick();
    }
    const state = h.session.getState();
    assert.equal(viewGame(state.game).side, 'b');
    assert.equal(state.game.phase, 'roll');
    assert.equal(flipped(state.game), true);
    assert.deepEqual(JSON.parse(h.store.getString()!), state.game);

    assert.deepEqual(h.errors, []);
    h.driver.dispose();
  }
});

test('Black remote navigation follows the flipped board', () => {
  const game = newGame('greedy', 'black-navigation', initialBot().start, 'b');
  const session = createGameSession(
    memory(JSON.stringify(game)),
    options,
    'bot',
  );
  keys(session, 'select');
  assert.equal(session.getState().focus.cursor, 'e7');
  keys(session, 'right');
  assert.equal(session.getState().focus.cursor, 'd7');
});

test('bot reply is shown one saved move at a time; process restore searches only the remainder', async () => {
  const store = memory(JSON.stringify(initialBot()));
  const session = createGameSession(store, options, 'bot');
  const before = session.getState().game;
  assert.throws(() => session.dispatch({ kind: 'bot' }), /asynchronous/);
  assert.equal(session.getState().game, before);
  session.dispatch({ kind: 'bot', reply: botReply(before) });
  assert.equal(session.getState().game.moves.length, 1);
  assert.equal(session.getState().pending.length, 2);
  const h = harness(store);
  assert.deepEqual(h.session.getState().game, session.getState().game);
  assert.deepEqual(h.session.getState().pending, []);
  h.driver.update(h.session.getState());
  await tick();
  assert.equal(h.requests.length, 1);
  const request = h.requests[0];
  assert.deepEqual(request.game, session.getState().game);
  assert.equal(request.game.moves.length, 1);
  assert.equal(viewGame(request.game).remaining, 'PP');
  request.resolve(botReply(request.game));
  h.run();
  await tick();
  h.run();
  assert.equal(h.session.getState().game.moves.length, 2);
  assert.equal(h.session.getState().pending.length, 1);
  h.driver.update(h.session.getState());
  h.run();
  h.run();
  assert.equal(h.session.getState().game.moves.length, 3);
  assert.equal(h.session.getState().game.phase, 'handoff');
  h.driver.update(h.session.getState());
  h.run();
  h.run();
  assert.equal(viewGame(h.session.getState().game).side, 'w');
  assert.equal(h.requests.length, 1);
  assert.deepEqual(h.errors, []);
  h.driver.dispose();
});

test('late reply waits behind Home and the menu without a duplicate search', async () => {
  const h = harness();
  const before = h.session.getState().game;
  h.driver.update(h.session.getState());
  await tick();
  h.activity.setActive(false);
  h.requests[0].resolve(botReply(before));
  await tick();
  h.run();
  h.run();
  assert.equal(h.session.getState().game, before);
  h.session.dispatch({ kind: 'key', key: 'back' });
  h.driver.update(h.session.getState());
  h.activity.setActive(true);
  h.run();
  h.run();
  assert.equal(h.session.getState().game, before);
  h.session.dispatch({ kind: 'key', key: 'back' });
  h.driver.update(h.session.getState());
  h.run();
  await tick();
  h.run();
  assert.equal(h.requests.length, 1);
  assert.equal(h.session.getState().game.moves.length, 1);
  h.driver.dispose();
  assert.equal(h.disposed(), 1);
});

test('synchronous menu/replacement before React cleanup and unmount discard late results', async () => {
  for (const action of ['menu', 'replace', 'dispose']) {
    const h = harness();
    const before = h.session.getState().game;
    h.driver.update(h.session.getState());
    await tick();
    h.run();
    h.session.dispatch({ kind: 'key', key: 'back' });
    if (action === 'replace')
      for (const key of [
        'down',
        'down',
        'select',
        'down',
        'select',
        'down',
        'select',
        'down',
        'select',
      ] as const)
        h.session.dispatch({ kind: 'key', key });
    if (action === 'dispose') h.driver.dispose();
    const current = h.session.getState().game;
    if (action === 'replace') {
      assert.notEqual(current.id, before.id);
      assert.equal(current.mode, 'greedy');
    }
    h.requests[0].resolve(botReply(before));
    await tick();
    h.run();
    assert.equal(h.session.getState().game, current);
    assert.equal(h.errors.length, 0);
    h.driver.dispose();
  }
});

test('worker failure leaves the saved turn unchanged and never falls back to an inline bot', async () => {
  const h = harness();
  const before = h.store.getString();
  h.driver.update(h.session.getState());
  await tick();
  h.requests[0].reject(new Error('worker failed'));
  h.run();
  await tick();
  h.run();
  assert.equal(h.errors.length, 1);
  assert.equal(h.store.getString(), before);
  h.driver.dispose();
});

test('failed bot-move persistence cannot publish the move or spend a die', () => {
  const store = memory(JSON.stringify(initialBot()));
  const session = createGameSession(store, options, 'bot');
  const before = session.getState();
  store.set = () => {
    throw new Error('disk full');
  };
  assert.throws(
    () => session.dispatch({ kind: 'bot', reply: botReply(before.game) }),
    /disk full/,
  );
  assert.equal(session.getState(), before);
});

test('a late bot reply waits throughout rules and the return menu, then resumes without a new search', async () => {
  const h = harness();
  const game = h.session.getState().game;
  const saved = h.store.getString();
  h.driver.update(h.session.getState());
  await tick();
  keys(h.session, 'back', 'up', 'select');
  assert.equal(h.session.getState().overlay.kind, 'rules');
  h.driver.update(h.session.getState());
  h.requests[0].resolve(botReply(game));
  await tick();
  h.run();
  h.run();
  assert.equal(h.session.getState().game, game);
  assert.equal(h.store.getString(), saved);
  keys(h.session, 'back');
  assert.deepEqual(h.session.getState().overlay, { kind: 'menu', index: 4 });
  h.driver.update(h.session.getState());
  h.run();
  h.run();
  assert.equal(h.store.getString(), saved);
  keys(h.session, 'back');
  h.driver.update(h.session.getState());
  h.run();
  await tick();
  h.run();
  assert.equal(h.session.getState().game.moves.length, 1);
  assert.equal(h.requests.length, 1);
  assert.deepEqual(h.errors, []);
  h.driver.dispose();
});

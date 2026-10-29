import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildSync } from 'esbuild';
import { newGame, rollGame, viewGame } from '../../src/core/game.ts';
import { botReply, type BotReply } from '../../src/core/bot.ts';
import type { ScreenOptions } from '../../native/src/screen.ts';
const dir = mkdtempSync(join(tmpdir(), 'android-bot-'));
after(() => rmSync(dir, { recursive: true, force: true }));
const bundled = buildSync({
  stdin: {
    contents:
      "export * from './src/gameSession'; export * from './src/botDriver'; export {createActivity} from '../native/src/activity';",
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
const { createGameSession, createBotDriver, createActivity } = (await import(
  pathToFileURL(file).href
)) as typeof import('../src/gameSession.ts') &
  typeof import('../src/botDriver.ts') &
  typeof import('../../native/src/activity.ts');
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
function harness() {
  const store = memory(JSON.stringify(initialBot()));
  const session = createGameSession(store, options, 'random');
  const activity = createActivity(true);
  const jobs: { run: () => void; canceled: boolean }[] = [];
  const requests: {
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
      request: () =>
        new Promise((resolve, reject) => requests.push({ resolve, reject })),
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

test('bot session keeps White, rejects wrong-mode saves, and confirms a same-opponent rematch', () => {
  const session = createGameSession(memory(), options, 'random');
  assert.equal(session.getState().game.human, 'w');
  for (const key of ['back', 'down', 'down', 'select'] as const)
    session.dispatch({ kind: 'key', key });
  assert.equal(session.getState().overlay.kind, 'confirm');
  const old = session.getState().game;
  session.dispatch({ kind: 'key', key: 'select' });
  assert.equal(session.getState().game, old);
  for (const key of ['down', 'down', 'select', 'down', 'select'] as const)
    session.dispatch({ kind: 'key', key });
  assert.notEqual(session.getState().game.id, old.id);
  assert.equal(session.getState().game.mode, 'random');
  assert.equal(session.getState().game.human, 'w');
  for (const game of [
    newGame('hotseat', 'wrong'),
    newGame('random', 'black', undefined, 'b'),
  ])
    assert.throws(
      () => createGameSession(memory(JSON.stringify(game)), options, 'random'),
      /different/,
    );
});

test('bot reply is shown one saved move at a time; process restore searches only the remainder', () => {
  const store = memory(JSON.stringify(initialBot()));
  const session = createGameSession(store, options, 'random');
  const before = session.getState().game;
  assert.throws(() => session.dispatch({ kind: 'bot' }), /asynchronous/);
  assert.equal(session.getState().game, before);
  session.dispatch({ kind: 'bot', reply: botReply(before) });
  assert.equal(session.getState().game.moves.length, 1);
  assert.equal(session.getState().pending.length, 2);
  const restored = createGameSession(store, options, 'random');
  assert.deepEqual(restored.getState().game, session.getState().game);
  assert.deepEqual(restored.getState().pending, []);
  restored.dispatch({ kind: 'bot', reply: botReply(restored.getState().game) });
  restored.dispatch({ kind: 'bot' });
  assert.equal(restored.getState().game.moves.length, 3);
  assert.equal(restored.getState().game.phase, 'handoff');
  restored.dispatch({ kind: 'bot' });
  assert.equal(viewGame(restored.getState().game).side, 'w');
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
      for (const key of ['down', 'down', 'select', 'down', 'select'] as const)
        h.session.dispatch({ kind: 'key', key });
    if (action === 'dispose') h.driver.dispose();
    const current = h.session.getState().game;
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
  const session = createGameSession(store, options, 'random');
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

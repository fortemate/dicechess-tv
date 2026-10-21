import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DiceChess } from '@fortemate/dicechess-engine';
import { MMKV } from '@amazon-devices/react-native-mmkv';
import { botReply, type BotReply } from '../../src/core/bot';
import {
  applyBotReply,
  decodeGame,
  newGame,
  rollGame,
} from '../../src/core/game';
import { createActivity } from '../src/activity';
import { createBotClient } from '../src/botClient';
import { createBotWorker } from '../src/botWorker';
// @ts-expect-error - a build script, deliberately plain JavaScript.
import { botBundle } from '../scripts/botBundle.mjs';
import {
  BOT_REQUEST,
  BOT_RESPONSE,
  readBotResult,
  runBotJob,
} from '../src/botJob';

const game = () =>
  rollGame(newGame('aggressive', 'worker', undefined, 'b'), [1, 1, 1]);
const flush = async () => {
  for (let i = 0; i < 20; i++) await Promise.resolve();
};

function rig(active = true, timeout = 120_000) {
  const values = new Map<string, string>();
  const jobs: { resolve: () => void; reject: (error: Error) => void }[] = [];
  const activity = createActivity(active);
  const timers = new Set<{ at: number; step: () => void }>();
  const state = {
    time: 0,
    launched: 0,
    id: 0,
    failLaunch: false,
    launchError: undefined as unknown,
    failStore: false,
  };
  const store = {
    getString: (key: string) => values.get(key),
    set(key: string, value: string) {
      if (state.failStore) throw new Error('storage failed');
      values.set(key, value);
    },
    delete: (key: string) => {
      values.delete(key);
    },
  };
  const client = createBotClient({
    store,
    activity,
    schedule(step, wait) {
      const timer = { at: state.time + wait, step };
      timers.add(timer);
      return () => {
        timers.delete(timer);
      };
    },
    now: () => state.time,
    newId: () => String(++state.id),
    timeout,
    launch: async () => {
      state.launched++;
      if (state.failLaunch)
        throw state.launchError ?? new Error('launch failed');
      return new Promise<void>((resolve, reject) => {
        jobs.push({ resolve, reject });
      });
    },
  });
  const pass = (ms: number) => {
    const until = state.time + ms;
    for (;;) {
      const next = [...timers].sort((a, b) => a.at - b.at)[0];
      if (!next || next.at > until) break;
      timers.delete(next);
      state.time = Math.max(state.time, next.at);
      next.step();
    }
    state.time = until;
  };
  const respond = (
    change: (reply: BotReply) => BotReply = (reply) => reply,
  ) => {
    const raw = values.get(BOT_REQUEST)!;
    const result = runBotJob(raw);
    assert.ok(result.reply);
    values.set(
      BOT_RESPONSE,
      JSON.stringify({ ...result, reply: change(result.reply) }),
    );
    jobs.at(-1)!.resolve();
    pass(100);
  };
  return { ...client, values, timers, activity, state, pass, respond, jobs };
}

test('the physical ANR board uses the unchanged canonical search and returns a complete legal path', (t) => {
  // Board transcribed from the physical store crash; hidden FEN metadata was
  // reconstructed. This is a repeatable search fixture, not an exported save.
  const saved = decodeGame(
    JSON.stringify({
      schema: 4,
      id: 'physical-rampage',
      mode: 'aggressive',
      human: 'b',
      colour: 'b',
      revision: 26,
      turn: 7,
      start: 'r1bqkbr1/p1pppppp/7B/4n2Q/3PP3/8/PPP2PPP/RN2KB1R w KQq - 0 4',
      roll: [3, 1, 5],
      moves: [],
      phase: 'move',
      result: null,
      lastMove: null,
    }),
  );
  const search = t.mock.method(DiceChess, 'getBestMove');
  const result = runBotJob(
    JSON.stringify({ requestId: 'physical', game: saved }),
  );
  assert.equal(search.mock.callCount(), 1);
  assert.deepEqual(search.mock.calls[0].arguments, [
    saved.start + ' BPQ',
    { algorithm: 'aggressive' },
  ]);
  assert.ok(result.reply);
  assert.equal(applyBotReply(saved, result.reply).phase, 'handoff');
});

test('invalid jobs and malformed responses never fall through to an engine search', () => {
  assert.throws(() => runBotJob('{}'), /Invalid opponent request/);
  assert.match(
    runBotJob(JSON.stringify({ requestId: 'x', game: {} })).error!,
    /./,
  );
  assert.throws(() => readBotResult('{', 'x'));
  assert.throws(
    () => readBotResult('{"requestId":"old"}', 'x'),
    /another request/,
  );
  assert.throws(
    () => readBotResult('{"requestId":"x","error":"failed"}', 'x'),
    /failed/,
  );
});

let engineCode: Promise<string> | undefined;
const bundledEngine = (): Promise<string> =>
  (engineCode ??= botBundle().then((result: { code: string }) => result.code));

const response = (code: string, ok = true) =>
  ({ ok, text: async () => code }) as Response;

test('the native worker executes the bundled canonical engine in an isolated runtime and reuses it', async (t) => {
  const code = await bundledEngine();
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 1000 });
  const fetch = t.mock.method(globalThis, 'fetch', async (url: unknown) => {
    assert.equal(url, 'file:///pkg/assets/raw/bot-engine.js');
    return response(code);
  });
  const store = new MMKV();
  store.set('dicechess-tv.game.v2', 'preserved');
  const worker = createBotWorker(createActivity(true));
  for (const id of ['first', 'second']) {
    const saved = { ...game(), id };
    const pending = worker.request(saved);
    await flush();
    t.mock.timers.tick(0);
    await flush();
    t.mock.timers.tick(100);
    const reply = await pending;
    assert.equal(reply.gameId, id);
    assert.equal(applyBotReply(saved, reply).phase, 'handoff');
  }
  assert.equal(fetch.mock.callCount(), 1, 'one asset load per runtime');
  assert.equal(store.getString(BOT_REQUEST), undefined);
  assert.equal(store.getString(BOT_RESPONSE), undefined);
  assert.equal(store.getString('dicechess-tv.game.v2'), 'preserved');
  worker.dispose();
  store.delete('dicechess-tv.game.v2');
});

test('asset load failures and background engine errors settle without changing a saved game', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 1000 });
  let mode = 'missing';
  t.mock.method(globalThis, 'fetch', async () =>
    response('invalid JavaScript !', mode !== 'missing'),
  );
  const store = new MMKV();
  store.set('dicechess-tv.game.v2', 'kept');
  for (mode of ['missing', 'broken']) {
    const worker = createBotWorker(createActivity(true));
    const pending = assert.rejects(
      worker.request(game()),
      /unavailable|SyntaxError|Unexpected/,
    );
    await flush();
    t.mock.timers.tick(0);
    await flush();
    t.mock.timers.tick(100);
    await pending;
    assert.equal(store.getString('dicechess-tv.game.v2'), 'kept');
    assert.equal(store.getString(BOT_REQUEST), undefined);
    worker.dispose();
  }
  store.delete('dicechess-tv.game.v2');
});

test('disposal while the asset loads cannot start or publish an abandoned search', async (t) => {
  const code = await bundledEngine();
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 1000 });
  let loaded!: (value: Response) => void;
  t.mock.method(
    globalThis,
    'fetch',
    () =>
      new Promise<Response>((resolve) => {
        loaded = resolve;
      }),
  );
  const worker = createBotWorker(createActivity(true));
  const pending = assert.rejects(worker.request(game()), /closed/);
  await flush();
  t.mock.timers.tick(0);
  await flush();
  worker.dispose();
  loaded(response(code));
  await flush();
  await pending;
  t.mock.timers.tick(1000);
  assert.equal(new MMKV().getString(BOT_REQUEST), undefined);
  assert.equal(new MMKV().getString(BOT_RESPONSE), undefined);
});

test('a failed result write rejects rather than throwing from the native callback', async (t) => {
  const code = await bundledEngine();
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 1000 });
  t.mock.method(globalThis, 'fetch', async () => response(code));
  const original = MMKV.prototype.set;
  t.mock.method(
    MMKV.prototype,
    'set',
    function (this: MMKV, key: string, value: string) {
      if (key === BOT_RESPONSE) throw new Error('result write failed');
      original.call(this, key, value);
    },
  );
  const worker = createBotWorker(createActivity(true));
  const pending = assert.rejects(worker.request(game()), /result write failed/);
  await flush();
  t.mock.timers.tick(0);
  await flush();
  t.mock.timers.tick(100);
  await pending;
  assert.equal(new MMKV().getString(BOT_REQUEST), undefined);
  worker.dispose();
});

test('requests serialize, match the full position, and clean only their mailbox keys', async () => {
  const r = rig();
  r.values.set('dicechess-tv.game.v2', 'untouched save');
  const first = r.request(game());
  const second = r.request({ ...game(), id: 'next' });
  await flush();
  r.pass(0);
  assert.equal(r.state.launched, 1);
  r.respond();
  assert.equal((await first).gameId, 'worker');
  await flush();
  r.pass(0);
  assert.equal(r.state.launched, 2);
  r.respond();
  assert.equal((await second).gameId, 'next');
  assert.deepEqual([...r.values], [['dicechess-tv.game.v2', 'untouched save']]);
  assert.equal(r.timers.size, 0);
});

test('a worker is launched after focus returns; its ready response survives a long background interval', async () => {
  const r = rig(false, 1000);
  const pending = r.request(game());
  await flush();
  r.pass(10_000);
  assert.equal(r.state.launched, 0);
  r.activity.setActive(true);
  r.pass(0);
  assert.equal(r.state.launched, 1);
  r.activity.setActive(false);
  r.values.set(
    BOT_RESPONSE,
    JSON.stringify(runBotJob(r.values.get(BOT_REQUEST)!)),
  );
  // A timer delayed by the OS checks for the result before its deadline.
  r.state.time += 10_000;
  r.pass(0);
  assert.equal((await pending).gameId, 'worker');
  r.dispose();
});

test('a suspended app does not spend a pending request deadline or disable later requests', async () => {
  const r = rig(true, 300);
  // Observe rejection immediately so the pre-fix failure remains an assertion,
  // rather than an unhandled rejection from the fake clock.
  const pending = r.request(game()).then(
    (reply) => ({ reply }),
    (error: unknown) => ({ error }),
  );
  await flush();
  r.pass(150);
  r.activity.setActive(false);
  // Vega may suspend the background runtime along with the UI. An unanswered
  // request then needs its remaining foreground time after focus returns.
  r.pass(10_000);
  await flush();
  assert.ok(r.values.has(BOT_REQUEST), 'background time expired the request');
  r.activity.setActive(true);
  r.respond();
  const result = await pending;
  assert.ok('reply' in result);
  assert.equal(result.reply.gameId, 'worker');
  const next = r.request({ ...game(), id: 'after-return' });
  await flush();
  r.pass(0);
  r.respond();
  assert.equal((await next).gameId, 'after-return');
  assert.equal(r.values.size, 0);
  r.dispose();
});

test('wrong position, stale request, malformed moves, and worker errors reject without searching on the caller', async () => {
  for (const change of [
    (reply: BotReply) => ({ ...reply, revision: reply.revision + 1 }),
    (reply: BotReply) => ({ ...reply, dfen: reply.dfen + ' ' }),
    (reply: BotReply) => ({ ...reply, moves: ['z9a1'] }),
  ]) {
    const r = rig();
    const pending = assert.rejects(r.request(game()));
    await flush();
    r.pass(0);
    r.respond(change);
    await pending;
    assert.equal(r.values.size, 0);
  }
  for (const response of [
    { requestId: 'old', reply: botReply(game()) },
    { requestId: '1', error: 'task failed' },
  ]) {
    const r = rig();
    const pending = assert.rejects(r.request(game()));
    await flush();
    r.pass(0);
    r.values.set(BOT_RESPONSE, JSON.stringify(response));
    r.pass(100);
    await pending;
  }
});

test('launch and storage failures settle the request; missing workers time out without overlapping another search', async () => {
  for (const failure of ['failLaunch', 'failStore'] as const) {
    const r = rig();
    r.state[failure] = true;
    const pending = assert.rejects(r.request(game()), /failed/);
    await flush();
    r.pass(0);
    await pending;
    assert.equal(r.values.size, 0);
    assert.equal(r.timers.size, 0);
  }
  const r = rig(true, 300);
  const first = assert.rejects(r.request(game()), /did not answer/);
  const second = assert.rejects(r.request(game()), /unavailable/);
  await flush();
  r.pass(300);
  await Promise.all([first, second]);
  assert.equal(r.state.launched, 1);
  assert.equal(r.values.size, 0);
});

test('non-Error launch rejections preserve their cause and still clear the request', async () => {
  for (const reason of ['bridge failed', { code: 'offline' }]) {
    const r = rig();
    r.state.failLaunch = true;
    r.state.launchError = reason;
    const pending = assert.rejects(r.request(game()), (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.equal(error.cause, reason);
      assert.equal(
        error.message,
        typeof reason === 'string' ? reason : 'Opponent worker failed',
      );
      return true;
    });
    await flush();
    r.pass(0);
    await pending;
    assert.equal(r.values.size, 0);
    assert.equal(r.timers.size, 0);
  }
});

test('a timed-out job blocks overlap only until its late success or failure settles', async () => {
  for (const lateFailure of [false, true]) {
    const r = rig(true, 300);
    r.values.set('dicechess-tv.game.v2', 'preserved save');
    const first = assert.rejects(r.request(game()), /did not answer/);
    await flush();
    r.pass(300);
    await first;
    await assert.rejects(r.request(game()), /unavailable/);
    assert.equal(r.state.launched, 1, 'a hanging job still blocks searches');
    if (lateFailure) r.jobs[0].reject(new Error('late failure'));
    else r.jobs[0].resolve();
    await flush();
    const next = r.request({ ...game(), id: 'after-timeout' });
    await flush();
    r.pass(0);
    r.respond();
    assert.equal((await next).gameId, 'after-timeout');
    assert.equal(r.state.launched, 2);
    assert.deepEqual(
      [...r.values],
      [['dicechess-tv.game.v2', 'preserved save']],
    );
    assert.equal(r.timers.size, 0);
  }
});

test('a settled transport with no response does not disable the next search', async () => {
  const r = rig(true, 300);
  const first = assert.rejects(r.request(game()), /did not answer/);
  await flush();
  r.pass(0);
  r.jobs[0].resolve();
  await flush();
  r.pass(300);
  await first;
  const next = r.request(game());
  await flush();
  r.pass(0);
  r.respond();
  await next;
  assert.equal(r.state.launched, 2);
});

test('disposal cannot be undone by the late settlement of a timed-out job', async () => {
  const r = rig(true, 300);
  const first = assert.rejects(r.request(game()), /did not answer/);
  await flush();
  r.pass(300);
  await first;
  r.dispose();
  r.jobs[0].resolve();
  await flush();
  await assert.rejects(r.request(game()), /unavailable/);
  assert.equal(r.state.launched, 1);
});

test('disposing while waiting for focus or a worker cancels polling and rejects queued work', async () => {
  for (const active of [false, true]) {
    const r = rig(active);
    const first = assert.rejects(r.request(game()), /closed/);
    const second = assert.rejects(r.request(game()), /unavailable/);
    await flush();
    r.pass(0);
    r.dispose();
    r.activity.setActive(true);
    r.pass(1000);
    await Promise.all([first, second]);
    assert.equal(r.values.size, 0);
    assert.equal(r.timers.size, 0);
  }
});

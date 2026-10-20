import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DiceChess } from '@fortemate/dicechess-engine';
import { MMKV } from '@amazon-devices/react-native-mmkv';
import { Linking } from 'react-native';
import { botReply, type BotReply } from '../../src/core/bot';
import {
  applyBotReply,
  decodeGame,
  newGame,
  rollGame,
} from '../../src/core/game';
import { createActivity } from '../src/activity';
import { createBotClient } from '../src/botClient';
import { runBotTask } from '../src/botTask';
import { createBotWorker } from '../src/botWorker';
import {
  BOT_REQUEST,
  BOT_RESPONSE,
  readBotResult,
  runBotJob,
} from '../src/botJob';

const game = () =>
  rollGame(newGame('aggressive', 'worker', undefined, 'b'), [1, 1, 1]);
const flush = async () => {
  for (let i = 0; i < 6; i++) await Promise.resolve();
};

function rig(active = true, timeout = 120_000) {
  const values = new Map<string, string>();
  const activity = createActivity(active);
  const timers = new Set<{ at: number; step: () => void }>();
  const state = {
    time: 0,
    launched: 0,
    id: 0,
    failLaunch: false,
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
      if (state.failLaunch) throw new Error('launch failed');
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
    pass(100);
  };
  return { ...client, values, timers, activity, state, pass, respond };
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

test('the task writes only its response and cannot overwrite a replacement request', async (t) => {
  const store = new MMKV();
  store.set('dicechess-tv.game.v2', 'preserved');
  const raw = JSON.stringify({ requestId: 'task', game: game() });
  store.set(BOT_REQUEST, raw);
  await runBotTask();
  assert.ok(readBotResult(store.getString(BOT_RESPONSE)!, 'task').reply);
  store.delete(BOT_RESPONSE);
  const original = DiceChess.getBestMove;
  t.mock.method(
    DiceChess,
    'getBestMove',
    (...args: Parameters<typeof original>) => {
      store.set(BOT_REQUEST, 'replacement');
      return original(...args);
    },
  );
  await runBotTask();
  assert.equal(store.getString(BOT_REQUEST), 'replacement');
  assert.equal(store.getString(BOT_RESPONSE), undefined);
  assert.equal(store.getString('dicechess-tv.game.v2'), 'preserved');
  store.delete(BOT_REQUEST);
  store.delete('dicechess-tv.game.v2');
});

test('the native worker addresses its private task and receives the default-MMKV reply', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 1_000 });
  const launch = t.mock.method(Linking, 'openURL', async (url: string) => {
    assert.match(url, /^pkg:\/\/com\.fortemate\.dicechesstv(?:\.qa)?\.search$/);
    await runBotTask();
  });
  const worker = createBotWorker(createActivity(true));
  const pending = worker.request(game());
  await flush();
  t.mock.timers.tick(0);
  await flush();
  t.mock.timers.tick(100);
  assert.equal((await pending).gameId, 'worker');
  assert.equal(launch.mock.callCount(), 1);
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

test('a task is launched after focus returns; its ready response survives a long background interval', async () => {
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

test('wrong position, stale request, malformed moves, and task errors reject without searching on the caller', async () => {
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

test('launch and storage failures settle the request; missing tasks time out without overlapping another task', async () => {
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

test('disposing while waiting for focus or a task cancels polling and rejects queued work', async () => {
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

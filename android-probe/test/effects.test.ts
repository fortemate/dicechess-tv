import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { DEFAULT_SOUND, soundGain } from '../../native/src/soundSetting.ts';
import {
  createEffects,
  openOptionalEffects,
  type EffectPlayer,
} from '../src/effects.ts';
import { CUE_FILES } from '../../native/src/cueFiles.ts';
import { cues, type Cue } from '../../src/core/cues.ts';
import {
  moveGame,
  newGame,
  resignGame,
  rollGame,
} from '../../src/core/game.ts';

function harness(
  active = true,
  configure = () => Promise.resolve(),
  sound = DEFAULT_SOUND,
) {
  const listeners = new Set<() => void>();
  const activity = {
    isActive: () => active,
    subscribe(fn: () => void) {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
  };
  const jobs: { run: () => void; ms: number; canceled: boolean }[] = [];
  const players: {
    cue: Cue;
    gain: number;
    played: number;
    paused: number;
    removed: number;
    unsubscribed: number;
    emit: (status: {
      playing: boolean;
      didJustFinish: boolean;
      currentTime: number;
    }) => void;
  }[] = [];
  const reports: { event: string; detail: unknown }[] = [];
  const backend = {
    configure,
    create(cue: Cue, gain: number): EffectPlayer {
      const record = {
        cue,
        gain,
        played: 0,
        paused: 0,
        removed: 0,
        unsubscribed: 0,
        emit: (_status: {
          playing: boolean;
          didJustFinish: boolean;
          currentTime: number;
        }) => {
          void _status;
        },
      };
      players.push(record);
      return {
        play: () => {
          record.played++;
        },
        pause: () => {
          record.paused++;
        },
        remove: () => {
          record.removed++;
        },
        addListener: (_event, fn) => {
          record.emit = fn;
          return {
            remove: () => {
              record.unsubscribed++;
            },
          };
        },
      };
    },
    report: (event: string, detail: unknown) => {
      reports.push({ event, detail });
    },
  };
  const effects = createEffects(
    activity,
    backend,
    (run, ms) => {
      const job = { run, ms, canceled: false };
      jobs.push(job);
      return () => {
        job.canceled = true;
      };
    },
    sound,
  );
  return {
    effects,
    backend,
    players,
    reports,
    jobs,
    listeners,
    active(value: boolean) {
      active = value;
      [...listeners].forEach((fn) => fn());
    },
  };
}

test('canonical capture and result cues play together; completion releases each player once', async () => {
  const h = harness();
  await Promise.resolve();
  const before = rollGame(
    newGame('hotseat', 'capture', '8/8/8/8/8/1k6/P7/7K w - - 0 1'),
    [1, 1, 1],
  );
  const after = moveGame(before, 'a2b3');
  assert.deepEqual(cues(before, after), ['piece_capture', 'game_win']);
  h.effects.play(cues(before, after));
  assert.deepEqual(
    h.players.map((p) => p.cue),
    ['piece_capture', 'game_win'],
  );
  for (const p of h.players) {
    p.emit({ playing: true, didJustFinish: false, currentTime: 0.1 });
    p.emit({ playing: false, didJustFinish: true, currentTime: 1 });
    p.emit({ playing: false, didJustFinish: true, currentTime: 1 });
    assert.deepEqual(
      [p.played, p.paused, p.removed, p.unsubscribed],
      [1, 1, 1, 1],
    );
  }
  h.effects.dispose();
  assert.equal(h.reports.filter((r) => r.event === 'finished').length, 2);
});

test('same-channel replacement is bounded and old callbacks cannot release its successor', async () => {
  const h = harness();
  await Promise.resolve();
  h.effects.play(['piece_move']);
  h.effects.play(['piece_capture']);
  assert.equal(h.players[0].removed, 1);
  h.players[0].emit({ playing: false, didJustFinish: true, currentTime: 1 });
  assert.equal(h.players[1].removed, 0);
  h.active(false);
  assert.equal(h.players[1].removed, 1);
  h.effects.dispose();
});

test('Home/blur cancels delayed no-move and active audio; return never replays it', async () => {
  const h = harness();
  await Promise.resolve();
  h.effects.play(['dice_roll', 'no_move']);
  const delayed = h.jobs.find((j) => j.ms === 500)!;
  h.active(false);
  h.active(true);
  delayed.run(); // Even an already queued timer is stale.
  assert.equal(delayed.canceled, true);
  assert.equal(h.players.length, 1);
  assert.equal(h.players[0].removed, 1);
  h.effects.play(['piece_move']);
  assert.equal(h.players.length, 2);
  h.effects.dispose();
  h.effects.play(['game_win']);
  assert.equal(h.listeners.size, 0);
  assert.equal(h.players.length, 2);
  assert.equal(h.players[1].removed, 1);
});

test('no-move follows the dice, but a silent transition or disposal drops it', async () => {
  for (const cancel of ['none', 'silent', 'dispose']) {
    const h = harness();
    await Promise.resolve();
    h.effects.play(['dice_roll', 'no_move']);
    if (cancel === 'silent') h.effects.play([]);
    if (cancel === 'dispose') h.effects.dispose();
    h.jobs.find((j) => j.ms === 500)!.run();
    assert.equal(h.players.length, cancel === 'none' ? 2 : 1);
    h.effects.dispose();
  }
});

test('background launch and late audio configuration do not replay early events', async () => {
  let ready!: () => void;
  const h = harness(
    false,
    () =>
      new Promise<void>((resolve) => {
        ready = resolve;
      }),
  );
  h.effects.play(['dice_roll']);
  h.active(true);
  h.effects.play(['piece_move']);
  ready();
  await Promise.resolve();
  assert.equal(h.players.length, 0);
  h.effects.play(['game_draw']);
  assert.equal(h.players.length, 1);
  h.effects.dispose();
  const late = harness();
  late.effects.dispose();
  await Promise.resolve();
  late.effects.play(['game_win']);
  assert.equal(late.players.length, 0);
});

test('configuration and native failures are nonfatal, and a stalled decoder is released', async () => {
  const failed = harness(true, () => Promise.reject(new Error('mode failed')));
  await Promise.resolve();
  await Promise.resolve();
  failed.effects.play(['dice_roll']);
  assert.equal(failed.players.length, 0);
  assert.equal(failed.reports[0].event, 'error');
  failed.effects.dispose();
  const h = harness();
  await Promise.resolve();
  h.effects.play(['game_win']);
  h.jobs.find((j) => j.ms === 10000)!.run();
  assert.equal(h.players[0].removed, 1);
  h.backend.create = () => {
    throw new Error('native player failed');
  };
  assert.doesNotThrow(() => h.effects.play(['dice_roll']));
  assert.equal(h.reports.at(-1)!.event, 'error');
  h.effects.dispose();
});

test('restoring a game and replacing it are silent; resignation uses the winning hotseat cue', () => {
  const game = newGame('hotseat', 'saved');
  assert.deepEqual(cues(game, game), []);
  assert.deepEqual(cues(game, newGame('hotseat', 'replacement')), []);
  assert.deepEqual(cues(game, resignGame(game)), ['game_win']);
});

test('every shared cue has a statically bundled asset and matching pinned bytes and license', () => {
  const mapping = readFileSync('src/effectAssets.ts', 'utf8');
  const lock = JSON.parse(
    readFileSync('../native/sounds/sounds.lock.json', 'utf8'),
  );
  for (const file of new Set(Object.values(CUE_FILES).flat())) {
    assert.ok(mapping.includes(`require('../assets/sfx/${file}')`), file);
    const [pack, name] = file.split('/');
    for (const asset of [name, 'LICENSE.txt']) {
      const hash = createHash('sha256')
        .update(readFileSync(`assets/sfx/${pack}/${asset}`))
        .digest('hex');
      assert.equal(hash, lock.packs[pack].files[asset].sha256);
    }
  }
});

test('persisted mute suppresses all effects and volume reaches the native backend', async () => {
  const muted = harness(true, undefined, { on: false, volume: 7 });
  const low = harness(true, undefined, { on: true, volume: 3 });
  await Promise.resolve();
  muted.effects.play(['dice_roll', 'no_move']);
  assert.equal(muted.players.length, 0);
  assert.equal(muted.jobs.length, 0);
  low.effects.play(['piece_move']);
  assert.equal(low.players[0].gain, soundGain(3));
  muted.effects.dispose();
  low.effects.dispose();
});

test('optional effects retain normal playback and disposal when setup succeeds', async () => {
  const h = harness();
  const effects = openOptionalEffects(
    () => h.effects,
    () => assert.fail('unexpected sound failure'),
  );
  assert.equal(effects, h.effects);
  await Promise.resolve();
  effects!.play(['dice_roll']);
  assert.equal(h.players.length, 1);
  effects!.dispose();
  assert.equal(h.players[0].removed, 1);
});

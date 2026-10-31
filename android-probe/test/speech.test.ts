import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildSync } from 'esbuild';
import { resolve } from 'node:path';
import type { SpeechStatus } from '../src/speech.ts';
const bundle = buildSync({
  stdin: {
    contents:
      "export * from './src/speech'; export * from './src/voicePreferences'; export * from '../native/src/voiceSetting'; export * from '../native/src/speechTiming';",
    resolveDir: resolve('.'),
  },
  bundle: true,
  platform: 'node',
  format: 'esm',
  write: false,
});
const {
  createSpeech,
  createVoicePreferences,
  readAndroidVoices,
  VOICE_KEY,
  voiceGain,
  LINE_TAIL_MS,
  RESULT_LINE_DELAY_MS,
} = (await import(
  'data:text/javascript;base64,' +
    Buffer.from(bundle.outputFiles[0].text).toString('base64')
)) as typeof import('../src/speech.ts') &
  typeof import('../src/voicePreferences.ts') &
  typeof import('../../native/src/voiceSetting.ts') &
  typeof import('../../native/src/speechTiming.ts');

/** Inject decoder events and a manual scheduler so stale work can be delivered deliberately. */
function harness(configure = () => Promise.resolve()) {
  let active = true;
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
  const jobs: { run: () => void; ms: number; cancelled: boolean }[] = [];
  const players: {
    id: string;
    volume: number;
    played: number;
    removed: number;
    emit: (s: SpeechStatus) => void;
  }[] = [];
  const events: string[] = [];
  const speech = createSpeech(
    activity,
    {
      configure,
      report: (e) => events.push(e),
      create(id, gain) {
        const record = {
          id,
          volume: gain,
          played: 0,
          removed: 0,
          emit: (_s: SpeechStatus) => {
            void _s;
          },
        };
        players.push(record);
        return {
          get volume() {
            return record.volume;
          },
          set volume(v) {
            record.volume = v;
          },
          play() {
            record.played++;
          },
          pause() {},
          remove() {
            record.removed++;
          },
          addListener(_e, fn) {
            record.emit = fn;
            return { remove() {} };
          },
        };
      },
    },
    { on: true, volume: 4 },
    (run, ms) => {
      const job = { run, ms, cancelled: false };
      jobs.push(job);
      return () => {
        job.cancelled = true;
      };
    },
  );
  return {
    speech,
    players,
    jobs,
    events,
    background() {
      active = false;
      [...listeners].forEach((fn) => fn());
    },
    foreground() {
      active = true;
      [...listeners].forEach((fn) => fn());
    },
  };
}
const intro = { id: 'rolly_intro_1', event: 'intro' as const };
const finish = { playing: false, didJustFinish: true };

test('speech waits for configuration and decoder completion plus tail, not metadata time', async () => {
  let ready!: () => void;
  const h = harness(
    () =>
      new Promise<void>((resolve) => {
        ready = resolve;
      }),
  );
  let ended = 0;
  h.speech.say(intro, () => ended++);
  assert.equal(h.players.length, 0);
  ready();
  await Promise.resolve();
  assert.equal(h.players[0].volume, voiceGain(4));
  assert.equal(ended, 0);
  h.players[0].emit(finish);
  h.players[0].emit(finish);
  assert.equal(ended, 0);
  const tail = h.jobs.find((j) => j.ms === LINE_TAIL_MS)!;
  assert.ok(tail);
  tail.run();
  assert.equal(ended, 1);
  assert.equal(h.players[0].removed, 1);
  h.speech.dispose();
});

test('replacement, stop, mute, suspension and disposal cancel decoder completion and stale timers', async () => {
  for (const action of ['replace', 'stop', 'mute', 'background', 'dispose']) {
    const h = harness();
    await Promise.resolve();
    let ended = 0;
    h.speech.say(intro, () => ended++);
    const old = h.players[0];
    old.emit(finish);
    if (action === 'replace') h.speech.say(intro);
    if (action === 'stop') h.speech.stopLine();
    if (action === 'mute') h.speech.setVoices(false);
    if (action === 'background') h.background();
    if (action === 'dispose') h.speech.dispose();
    old.emit(finish);
    for (const job of [...h.jobs]) job.run();
    assert.equal(ended, 0, action);
    assert.equal(old.removed, 1);
    h.speech.dispose();
  }
});

test('background during initialization or a result delay drops speech permanently', async () => {
  let ready!: () => void;
  const h = harness(
    () =>
      new Promise<void>((resolve) => {
        ready = resolve;
      }),
  );
  h.speech.say(intro);
  h.background();
  ready();
  await Promise.resolve();
  h.foreground();
  assert.equal(h.players.length, 0);
  h.speech.say({ id: 'rolly_win_1', event: 'win' });
  const delay = h.jobs.find((j) => j.ms === RESULT_LINE_DELAY_MS)!;
  assert.ok(delay);
  h.background();
  delay.run();
  h.foreground();
  assert.equal(h.players.length, 0);
  h.speech.dispose();
});

test('errors and timeouts release speech without completing a tutorial line; gain applies to active playback', async () => {
  for (const failure of ['decoder', 'timeout']) {
    const h = harness();
    await Promise.resolve();
    let ended = 0;
    h.speech.say(intro, () => ended++);
    h.speech.setVoiceVolume(0.5);
    assert.equal(h.players[0].volume, 0.5);
    if (failure === 'decoder')
      h.players[0].emit({ ...finish, playbackState: 'error' });
    else h.jobs[0].run();
    assert.equal(ended, 0);
    assert.equal(h.players[0].removed, 1);
    h.speech.dispose();
  }
});

test('voice preference writes are atomic and preserve legacy data and failed-write state', () => {
  const values = new Map<string, string>();
  const store = {
    getString: (key: string) => values.get(key),
    set: (key: string, value: string) => {
      values.set(key, value);
    },
    delete: (key: string) => {
      values.delete(key);
    },
  };
  values.set('dicechess-tv.voiceVolume.v1', '4');
  const prefs = createVoicePreferences(store);
  assert.deepEqual(prefs.read(), { on: true, volume: 4 });
  prefs.press('select');
  assert.deepEqual(readAndroidVoices(store), { on: false, volume: 4 });
  prefs.press('select');
  prefs.press('left');
  assert.deepEqual(readAndroidVoices(store), { on: true, volume: 3 });
  assert.equal(values.get('dicechess-tv.voiceVolume.v1'), '4');
  const failing = createVoicePreferences({
    ...store,
    set() {
      throw new Error('disk');
    },
  });
  assert.throws(() => failing.press('select'), /disk/);
  assert.deepEqual(failing.read(), readAndroidVoices(store));
  values.set(VOICE_KEY, '{broken');
  assert.throws(() => readAndroidVoices(store));
});

test('synchronous and asynchronous configuration failures leave speech inert and disposable', async () => {
  for (const configure of [
    () => {
      throw new Error('configure');
    },
    () => Promise.reject(new Error('configure')),
  ]) {
    const h = harness(configure);
    let ended = 0;
    h.speech.say(intro, () => ended++);
    await Promise.resolve();
    await Promise.resolve();
    assert.equal(h.players.length, 0);
    assert.equal(ended, 0);
    assert.ok(h.events.includes('error'));
    h.speech.dispose();
  }
});

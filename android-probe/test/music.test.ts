import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildSync } from 'esbuild';
import { resolve } from 'node:path';
import type { MusicStatus } from '../src/musicPlayer.ts';
const bundle = buildSync({
  stdin: {
    contents:
      "export * from './src/musicControl'; export * from './src/musicPlayer'; export * from './src/musicPreferences'; export * from '../native/src/musicEngine'; export * from '../native/src/musicSetting';",
    resolveDir: resolve('.'),
  },
  bundle: true,
  platform: 'node',
  format: 'esm',
  write: false,
  metafile: true,
});
const {
  musicPlayer,
  musicControl,
  speechDucking,
  createMusicPreferences,
  readAndroidMusic,
  MUSIC_KEY,
  DEFAULT_MUSIC,
  musicGain,
} = (await import(
  'data:text/javascript;base64,' +
    Buffer.from(bundle.outputFiles[0].text).toString('base64')
)) as typeof import('../src/musicControl.ts') &
  typeof import('../src/musicPlayer.ts') &
  typeof import('../src/musicPreferences.ts') &
  typeof import('../../native/src/musicEngine.ts') &
  typeof import('../../native/src/musicSetting.ts');

/** Record native operations and keep decoder callbacks callable after release. */
function harness(configure = () => Promise.resolve()) {
  const records: {
    file: string;
    volume: number;
    duration: number;
    currentTime: number;
    plays: number;
    removed: number;
    seeks: number[];
    emit: (s: MusicStatus) => void;
  }[] = [];
  const player = musicPlayer({
    configure,
    report() {},
    create(file) {
      const record = {
        file,
        volume: 0,
        duration: 180,
        currentTime: 0,
        plays: 0,
        removed: 0,
        seeks: [] as number[],
        emit: (_s: MusicStatus) => {
          void _s;
        },
      };
      records.push(record);
      return {
        get volume() {
          return record.volume;
        },
        set volume(v) {
          record.volume = v;
        },
        get duration() {
          return record.duration;
        },
        get currentTime() {
          return record.currentTime;
        },
        play() {
          record.plays++;
        },
        pause() {},
        remove() {
          record.removed++;
        },
        async seekTo(n) {
          record.seeks.push(n);
          record.currentTime = n;
        },
        addListener(_event, fn) {
          record.emit = fn;
          return { remove() {} };
        },
      };
    },
  });
  return { player, records };
}

test('shared music engine and Android adapters bundle without the Vega media module', () => {
  assert.ok(
    !Object.keys(bundle.metafile!.inputs).some(
      (file) => file.includes('w3cmedia') || file.endsWith('/music.ts'),
    ),
  );
});

test('Android music bridge delivers metadata, movement, gain and decoder events to the shared engine', async () => {
  const h = harness();
  let ready = 0,
    playing = 0,
    ended = 0;
  h.player.addEventListener('canplay', () => ready++);
  h.player.addEventListener('playing', () => playing++);
  h.player.addEventListener('ended', () => ended++);
  await h.player.initialize();
  h.player.volume = 0.3;
  h.player.src = 'android-music/menu.mp3';
  assert.equal(ready, 1);
  assert.equal(h.records[0].volume, 0.3);
  await h.player.play();
  assert.equal(h.records[0].plays, 1);
  h.player.currentTime = 0.7;
  assert.equal(h.player.currentTime, 0.7);
  assert.deepEqual(h.records[0].seeks, [0.7]);
  const status = {
    isLoaded: true,
    duration: 180,
    currentTime: 1,
    playing: true,
    didJustFinish: false,
    playbackState: 'readyToPlay',
  };
  h.records[0].emit(status);
  h.records[0].emit(status);
  assert.equal(playing, 1);
  h.records[0].emit({ ...status, playing: false, didJustFinish: true });
  assert.equal(ended, 1);
  assert.throws(() => {
    h.player.src = 'second.mp3';
  }, /once/);
  await h.player.deinitialize();
  await h.player.deinitialize();
  assert.equal(h.records[0].removed, 1);
  assert.equal(h.records[0].volume, 0);
  h.records[0].emit(status);
  assert.equal(playing, 1);
});

test('release while initialization waits prevents all later native work', async () => {
  let resolve!: () => void;
  const h = harness(
    () =>
      new Promise<void>((done) => {
        resolve = done;
      }),
  );
  const initialized = h.player.initialize();
  await h.player.deinitialize();
  resolve();
  await initialized;
  h.player.src = 'late.mp3';
  h.player.volume = 1;
  h.player.currentTime = 5;
  await h.player.play();
  assert.equal(h.records.length, 0);
});

test('music defaults, stepping and atomic persistence preserve legacy values and failed-write state', () => {
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
  assert.deepEqual(readAndroidMusic(store), DEFAULT_MUSIC);
  values.set('dicechess-tv.musicVolume.v1', '4');
  const p = createMusicPreferences(store);
  p.press('select');
  assert.deepEqual(readAndroidMusic(store), { on: false, volume: 4 });
  p.press('select');
  p.press('right');
  assert.deepEqual(readAndroidMusic(store), { on: true, volume: 5 });
  assert.equal(values.get('dicechess-tv.musicVolume.v1'), '4');
  const failing = createMusicPreferences({
    ...store,
    set() {
      throw new Error('disk');
    },
  });
  assert.throws(() => failing.press('select'), /disk/);
  assert.deepEqual(failing.read(), readAndroidMusic(store));
  assert.equal(musicGain(0), 0);
  assert.equal(musicGain(10), 1);
  values.set(MUSIC_KEY, '{broken');
  assert.throws(() => readAndroidMusic(store));
});

test('route-level menu requests retain the result pause before and after player attachment', () => {
  const control = musicControl();
  const roles: unknown[] = [];
  control.setRole('menu', 2500);
  control.setRole('menu');
  control.attach({
    setRole: (role, pause) => roles.push([role, pause]),
    setEnabled() {},
    setVolume() {},
    setSuspended() {},
    setCatalogue() {},
    setDucked() {},
    dispose() {},
  });
  assert.deepEqual(roles, [['menu', 2500]]);
  control.setRole('menu');
  assert.equal(roles.length, 1);
  control.setRole('calm');
  assert.deepEqual(roles[1], ['calm', 0]);
  control.dispose();
});

test('only the active speech owner ducks music; late failure/disposal events cannot unduck a successor', () => {
  const changes: boolean[] = [];
  const old = speechDucking((on) => changes.push(on));
  const next = speechDucking((on) => changes.push(on));
  old('playing');
  old('playing');
  old('released');
  old('disposed');
  next('playing');
  old('error');
  old('playing');
  assert.deepEqual(changes, [true, false, true]);
  next('disposed');
  next('error');
  assert.deepEqual(changes, [true, false, true, false]);
});

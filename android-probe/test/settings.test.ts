import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createSoundPreferences,
  readAndroidSound,
  SOUND_KEY,
} from '../src/soundPreferences.ts';

const memory = () => {
  const values = new Map<string, string>();
  return {
    values,
    getString: (key: string) => values.get(key),
    set: (key: string, value: string) => {
      values.set(key, value);
    },
    delete: (key: string) => {
      values.delete(key);
    },
  };
};
test('volume and mute survive reopening; navigation and boundaries do not write', () => {
  const store = memory();
  const prefs = createSoundPreferences(store);
  assert.deepEqual(prefs.read(), { on: true, volume: 10 });
  for (const key of ['up', 'down', 'back', 'right'] as const) prefs.press(key);
  assert.equal(store.values.size, 0);
  prefs.press('left');
  prefs.press('select');
  assert.deepEqual(createSoundPreferences(store).read(), {
    on: false,
    volume: 9,
  });
  const reopened = createSoundPreferences(store);
  assert.deepEqual(reopened.press('select'), { on: true, volume: 9 });
  for (let i = 0; i < 10; i++) reopened.press('left');
  assert.deepEqual(reopened.read(), { on: false, volume: 1 });
  assert.deepEqual(reopened.press('right'), { on: true, volume: 1 });
});
test('failed persistence never publishes the new sound setting', () => {
  const store = memory();
  const prefs = createSoundPreferences({
    ...store,
    set() {
      throw new Error('disk');
    },
  });
  assert.throws(() => prefs.press('left'), /disk/);
  assert.deepEqual(prefs.read(), { on: true, volume: 10 });
});

test('legacy mute and volume migrate in one write without changing the legacy pair', () => {
  const store = memory();
  store.values.set('dicechess-tv.sound.v1', 'off');
  store.values.set('dicechess-tv.soundVolume.v1', '5');
  let writes = 0;
  const prefs = createSoundPreferences({
    ...store,
    set(key, value) {
      assert.equal(++writes, 1, 'A complete choice requires exactly one write');
      assert.equal(key, SOUND_KEY);
      store.set(key, value);
    },
  });
  assert.deepEqual(prefs.read(), { on: false, volume: 5 });
  assert.equal(writes, 0);
  assert.deepEqual(prefs.press('right'), { on: true, volume: 1 });
  assert.deepEqual(readAndroidSound(store), { on: true, volume: 1 });
  assert.equal(store.getString('dicechess-tv.sound.v1'), 'off');
  assert.equal(store.getString('dicechess-tv.soundVolume.v1'), '5');
});

test('a failed atomic save leaves reopened legacy or migrated choices unchanged', () => {
  for (const migrated of [false, true]) {
    const store = memory();
    store.values.set('dicechess-tv.sound.v1', 'off');
    store.values.set('dicechess-tv.soundVolume.v1', '5');
    if (migrated)
      store.values.set(SOUND_KEY, JSON.stringify({ on: false, volume: 7 }));
    const before = [...store.values];
    const prefs = createSoundPreferences({
      ...store,
      set() {
        throw new Error('disk');
      },
    });
    const previous = prefs.read();
    assert.throws(() => prefs.press('right'), /disk/);
    assert.deepEqual([...store.values], before);
    assert.deepEqual(prefs.read(), previous);
    assert.deepEqual(readAndroidSound(store), previous);
  }
});

test('invalid atomic settings and read failures surface without overwriting or falling back', () => {
  for (const raw of [
    '{',
    'null',
    '[]',
    '{}',
    '{"on":1,"volume":5}',
    '{"on":true,"volume":-1}',
    '{"on":true,"volume":11}',
    '{"on":true,"volume":1.5}',
  ]) {
    const store = memory();
    store.values.set(SOUND_KEY, raw);
    assert.throws(() => createSoundPreferences(store));
    assert.equal(store.getString(SOUND_KEY), raw);
  }
  assert.throws(
    () =>
      readAndroidSound({
        ...memory(),
        getString() {
          throw new Error('unreadable');
        },
      }),
    /unreadable/,
  );
});

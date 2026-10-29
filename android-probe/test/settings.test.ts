import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createSoundPreferences } from '../src/soundPreferences.ts';

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

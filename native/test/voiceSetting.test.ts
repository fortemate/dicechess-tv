import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readVoices, saveVoices } from '../src/voiceSetting';
import type { KeyValueStore } from '../src/mmkvStore';

const memoryStore = (initial?: Record<string, string>): KeyValueStore => {
  const map = new Map<string, string>(Object.entries(initial ?? {}));
  return {
    getString: (key: string) => map.get(key),
    set: (key: string, value: string) => {
      map.set(key, value);
    },
    delete: (key: string) => {
      map.delete(key);
    },
  };
};

test('the bots speak by default', () => {
  assert.equal(readVoices(memoryStore()), true);
});

test('turning the voices off is remembered, and so is turning them back on', () => {
  const store = memoryStore();
  saveVoices(store, false);
  assert.equal(readVoices(store), false);
  saveVoices(store, true);
  assert.equal(readVoices(store), true);
});

test('a damaged value leaves the voices on', () => {
  assert.equal(
    readVoices(memoryStore({ 'dicechess-tv.voices.v1': 'garbled' })),
    true,
  );
});

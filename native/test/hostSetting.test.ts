import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readHost, saveHost } from '../src/hostSetting';
import { saveVoices } from '../src/voiceSetting';
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

test('Rolly hosts Hot Seat games by default (#202)', () => {
  assert.equal(readHost(memoryStore()), true);
});

test('turning the host off is remembered, and so is turning him back on', () => {
  const store = memoryStore();
  saveHost(store, false);
  assert.equal(readHost(store), false);
  saveHost(store, true);
  assert.equal(readHost(store), true);
});

test('a damaged value leaves the host on', () => {
  assert.equal(
    readHost(memoryStore({ 'dicechess-tv.host.v1': 'garbled' })),
    true,
  );
});

test('the host and the voices are settings of their own', () => {
  const store = memoryStore();
  saveVoices(store, false);
  assert.equal(readHost(store), true);
  saveHost(store, false);
  saveVoices(store, true);
  assert.equal(readHost(store), false);
});

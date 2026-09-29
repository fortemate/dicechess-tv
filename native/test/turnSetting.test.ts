import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readTurnBoard, saveTurnBoard } from '../src/turnSetting';
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

test('turn board setting is off by default', () => {
  const store = memoryStore();
  assert.equal(readTurnBoard(store), false);
});

test('saving on turns the board in hotseat', () => {
  const store = memoryStore();
  saveTurnBoard(store, true);
  assert.equal(readTurnBoard(store), true);
});

test('saving off returns to the default orientation', () => {
  const store = memoryStore();
  saveTurnBoard(store, true);
  assert.equal(readTurnBoard(store), true);
  saveTurnBoard(store, false);
  assert.equal(readTurnBoard(store), false);
});

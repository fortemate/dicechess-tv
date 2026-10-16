import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_VOICES,
  readVoices,
  saveVoices,
  stepVoices,
  toggleVoices,
  voiceGain,
  voicesHeard,
} from '../src/voiceSetting';
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

test('the bots speak by default at full volume', () => {
  assert.deepEqual(readVoices(memoryStore()), DEFAULT_VOICES);
  assert.equal(voicesHeard(DEFAULT_VOICES), true);
});

test('turning the voices off is remembered, and so is turning them back on', () => {
  const store = memoryStore();
  saveVoices(store, { on: false, volume: 8 });
  assert.deepEqual(readVoices(store), { on: false, volume: 8 });
  assert.equal(voicesHeard(readVoices(store)), false);
  saveVoices(store, { on: true, volume: 8 });
  assert.deepEqual(readVoices(store), { on: true, volume: 8 });
  assert.equal(voicesHeard(readVoices(store)), true);
});

test('a legacy boolean stored value decodes safely', () => {
  assert.deepEqual(
    readVoices(memoryStore({ 'dicechess-tv.voices.v1': 'off' })),
    { on: false, volume: 10 },
  );
  assert.deepEqual(
    readVoices(memoryStore({ 'dicechess-tv.voices.v1': 'on' })),
    { on: true, volume: 10 },
  );
  assert.deepEqual(
    readVoices(memoryStore({ 'dicechess-tv.voices.v1': 'garbled' })),
    { on: true, volume: 10 },
  );
});

test('stepping the voices volume up and down', () => {
  const full = { on: true, volume: 10 };
  assert.deepEqual(stepVoices(full, 1), full);
  assert.deepEqual(stepVoices(full, -1), { on: true, volume: 9 });

  const lowest = { on: true, volume: 1 };
  assert.deepEqual(stepVoices(lowest, -1), { on: false, volume: 1 });

  const muted = { on: false, volume: 5 };
  assert.deepEqual(stepVoices(muted, 1), { on: true, volume: 1 });
  assert.deepEqual(stepVoices(muted, -1), muted);
});

test('toggling voices mute preserves and restores volume', () => {
  const active = { on: true, volume: 6 };
  const muted = toggleVoices(active);
  assert.deepEqual(muted, { on: false, volume: 6 });
  assert.deepEqual(toggleVoices(muted), { on: true, volume: 6 });

  const zero = { on: true, volume: 0 };
  assert.deepEqual(toggleVoices(zero), { on: true, volume: 10 });
});

test('voice gain follows decibel steps', () => {
  assert.equal(voiceGain(10), 1);
  assert.ok(Math.abs(voiceGain(9) - 10 ** (-3 / 20)) < 1e-6);
  assert.equal(voiceGain(0), 0);
  assert.equal(voiceGain(-1), 0);
});

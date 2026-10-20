import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_SOUND,
  readSound,
  saveSound,
  stepSound,
  toggleSound,
  soundGain,
  soundHeard,
} from '../src/soundSetting';
import { memoryStore } from './support';

test('sounds are on by default at full volume', () => {
  assert.deepEqual(readSound(memoryStore()), DEFAULT_SOUND);
  assert.equal(soundHeard(DEFAULT_SOUND), true);
});

test('turning sounds off is remembered, and so is turning them back on', () => {
  const store = memoryStore();
  saveSound(store, { on: false, volume: 8 });
  assert.deepEqual(readSound(store), { on: false, volume: 8 });
  assert.equal(soundHeard(readSound(store)), false);
  saveSound(store, { on: true, volume: 8 });
  assert.deepEqual(readSound(store), { on: true, volume: 8 });
  assert.equal(soundHeard(readSound(store)), true);
});

test('a legacy boolean stored value decodes safely', () => {
  assert.deepEqual(readSound(memoryStore({ 'dicechess-tv.sound.v1': 'off' })), {
    on: false,
    volume: 10,
  });
  assert.deepEqual(readSound(memoryStore({ 'dicechess-tv.sound.v1': 'on' })), {
    on: true,
    volume: 10,
  });
  assert.deepEqual(
    readSound(memoryStore({ 'dicechess-tv.sound.v1': 'garbled' })),
    { on: true, volume: 10 },
  );
});

test('stepping the sound volume up and down', () => {
  const full = { on: true, volume: 10 };
  assert.deepEqual(stepSound(full, 1), full);
  assert.deepEqual(stepSound(full, -1), { on: true, volume: 9 });

  const lowest = { on: true, volume: 1 };
  assert.deepEqual(stepSound(lowest, -1), { on: false, volume: 1 });

  const muted = { on: false, volume: 5 };
  assert.deepEqual(stepSound(muted, 1), { on: true, volume: 1 });
  assert.deepEqual(stepSound(muted, -1), muted);
});

test('toggling sounds mute preserves and restores volume', () => {
  const active = { on: true, volume: 6 };
  const muted = toggleSound(active);
  assert.deepEqual(muted, { on: false, volume: 6 });
  assert.deepEqual(toggleSound(muted), { on: true, volume: 6 });

  const zero = { on: true, volume: 0 };
  assert.deepEqual(toggleSound(zero), { on: true, volume: 10 });
});

test('sound gain follows decibel steps', () => {
  assert.equal(soundGain(10), 1);
  assert.ok(Math.abs(soundGain(9) - 10 ** (-3 / 20)) < 1e-6);
  assert.equal(soundGain(0), 0);
  assert.equal(soundGain(-1), 0);
});

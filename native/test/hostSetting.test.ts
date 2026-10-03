import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  HOSTS,
  HOST_CHOICES,
  cycleHost,
  hostName,
  readHost,
  saveHost,
} from '../src/hostSetting';
import { saveVoices } from '../src/voiceSetting';
import type { KeyValueStore } from '../src/mmkvStore';

const KEY = 'dicechess-tv.host.v1';

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
  assert.equal(readHost(memoryStore()), 'rolly');
});

test('turning the host off is remembered, and so is choosing Rolly again', () => {
  const store = memoryStore();
  saveHost(store, 'off');
  assert.equal(readHost(store), 'off');
  saveHost(store, 'rolly');
  assert.equal(readHost(store), 'rolly');
});

test('the character is stored by its id', () => {
  const store = memoryStore();
  saveHost(store, 'rolly');
  assert.equal(store.getString(KEY), 'rolly');
  saveHost(store, 'off');
  assert.equal(store.getString(KEY), 'off');
});

test('anything but "off" reads as Rolly: an early build\'s "on", or a damaged value', () => {
  for (const stored of ['on', 'garbled', '', 'Rolly'])
    assert.equal(readHost(memoryStore({ [KEY]: stored })), 'rolly', stored);
});

test('Settings steps through the hosts, then off, and round again', () => {
  assert.deepEqual(
    HOSTS.map((host) => [host.id, host.name]),
    [['rolly', 'Rolly']],
  );
  assert.deepEqual(HOST_CHOICES, ['rolly', 'off']);
  assert.equal(hostName('rolly'), 'Rolly');
  assert.equal(hostName('off'), 'off');
  assert.equal(cycleHost('rolly'), 'off');
  assert.equal(cycleHost('off'), 'rolly');
  assert.equal(cycleHost('rolly', -1), 'off');
  assert.equal(cycleHost('off', -1), 'rolly');
});

test('the host and the voices are settings of their own', () => {
  const store = memoryStore();
  saveVoices(store, false);
  assert.equal(readHost(store), 'rolly');
  saveHost(store, 'off');
  saveVoices(store, true);
  assert.equal(readHost(store), 'off');
});

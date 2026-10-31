import assert from 'node:assert/strict';
import { test } from 'node:test';
import { registerHooks } from 'node:module';
import React from 'react';
import { Text } from 'react-native';
import { act } from 'react-test-renderer';
import type { KeyValueStore } from '../src/keyValueStore';
import { createActivity } from '../src/activity';
import {
  readTutorialOffered,
  saveTutorialOffered,
} from '../src/tutorialOfferSetting';
import { mount, unmount, send, text, silentSounds } from './support';
import { focusedLabel } from './options';

const stores = new Map<string, Map<string, string>>();
const writes: string[] = [];
let failWrite = false,
  failRead = false;
/** Keep every game namespace separate and record all writes, including deletions. */
function openStore(id: string): KeyValueStore {
  if (!stores.has(id)) stores.set(id, new Map());
  const values = stores.get(id)!;
  return {
    getString: (key) => {
      if (failRead) throw new Error('read unavailable');
      return values.get(key);
    },
    set: (key, value) => {
      if (failWrite) throw new Error('write unavailable');
      writes.push(id + ':' + key);
      values.set(key, value);
    },
    delete: (key) => {
      writes.push('delete:' + id + ':' + key);
      values.delete(key);
    },
  };
}
const port = Symbol.for('android-tutorial-offer-test');
Reflect.set(globalThis, port, { openStore, voice: silentSounds() });
const reactUrl = import.meta.resolve('react');
const activityUrl = new URL('../src/activity.ts', import.meta.url).href;
registerHooks({
  /** Reuse native CI's renderer; stub only Android storage, speech and remote adapters. */
  resolve(specifier, context, nextResolve) {
    if (context.parentURL?.includes('/android-probe/')) {
      if (specifier === 'react' || specifier.startsWith('react/'))
        return nextResolve(specifier, {
          ...context,
          parentURL: import.meta.url,
        });
      const code =
        specifier === './store'
          ? "export const createStore = (id) => globalThis[Symbol.for('android-tutorial-offer-test')].openStore(id);"
          : specifier === './useAndroidVoice'
            ? "export const useAndroidVoice = () => globalThis[Symbol.for('android-tutorial-offer-test')].voice;"
            : specifier === './RemoteSurface'
              ? `import React from ${JSON.stringify(reactUrl)}; import {ActivityContext} from ${JSON.stringify(activityUrl)}; export const RemoteSurface = ({activity, children}) => React.createElement(ActivityContext.Provider, {value: activity}, children);`
              : null;
      if (code)
        return {
          url: 'data:text/javascript,' + encodeURIComponent(code),
          shortCircuit: true,
        };
    }
    return nextResolve(specifier, context);
  },
});
// Runtime URLs keep native CI independent of Android dependencies and type packages.
const url = new URL('../../android-probe/src/FirstLaunch.tsx', import.meta.url);
const { FirstLaunch } = (await import(url.href)) as {
  FirstLaunch: React.ComponentType<{
    activity: ReturnType<typeof createActivity>;
    enabled: boolean;
    onLearn(): void;
    children: React.ReactNode;
  }>;
};
const settingsId = 'dicechess-android-settings';
const gameId = 'dicechess-android-game';

/** Start with real empty stores; rerendering the shell models a process restart. */
function rig() {
  stores.clear();
  writes.length = 0;
  failWrite = false;
  failRead = false;
  const activity = createActivity(true);
  let learned = 0;
  const launch = (enabled = true) => {
    unmount();
    return mount(
      <FirstLaunch
        activity={activity}
        enabled={enabled}
        onLearn={() => {
          learned++;
        }}
      >
        <Text>Home fixture</Text>
      </FirstLaunch>,
    ).root;
  };
  return { launch, activity, learned: () => learned };
}

test('a new Android install draws Thinkle and the shared choices; unanswered navigation is not persisted', () => {
  const h = rig();
  try {
    let root = h.launch();
    assert.match(text(root), /THINKLE\nYour teacher/);
    assert.match(text(root), /New to Dice Chess/);
    assert.equal(focusedLabel(root), 'Learn to play');
    send('left');
    assert.equal(focusedLabel(root), 'Skip');
    send('right');
    assert.equal(focusedLabel(root), 'Learn to play');
    send('down');
    assert.deepEqual(writes, []);
    assert.equal(stores.get(gameId)?.size, 0);
    root = h.launch();
    assert.equal(focusedLabel(root), 'Learn to play');
    assert.deepEqual(writes, []);
  } finally {
    unmount();
  }
});

for (const answer of ['learn', 'skip', 'back'] as const) {
  test(`Android ${answer} remembers the answer once before routing and skips the offer on relaunch`, () => {
    const h = rig();
    try {
      const root = h.launch();
      const data = new Map(stores.get(gameId));
      act(() => {
        if (answer === 'skip') send('down');
        send(answer === 'back' ? 'back' : 'enter');
        send('enter');
      });
      assert.equal(h.learned(), answer === 'learn' ? 1 : 0);
      assert.equal(readTutorialOffered(openStore(settingsId)), true);
      assert.equal(writes.length, 1);
      assert.deepEqual(stores.get(gameId), data);
      assert.doesNotMatch(text(root), /New to Dice Chess/);
      assert.match(text(h.launch()), /Home fixture/);
    } finally {
      unmount();
    }
  });
}

test('current, damaged and legacy saves suppress onboarding without changing any data', () => {
  for (const id of [
    gameId,
    'dicechess-android-hotseat',
    'dicechess-android-bot',
  ]) {
    for (const raw of [
      '',
      'unreadable retained save',
      '{"exact":"partial turn"}',
    ]) {
      const h = rig();
      openStore(id).set('game.v1', raw);
      writes.length = 0;
      try {
        assert.match(text(h.launch()), /Home fixture/);
        assert.equal(openStore(id).getString('game.v1'), raw);
        assert.deepEqual(writes, []);
        assert.equal(readTutorialOffered(openStore(settingsId)), false);
      } finally {
        unmount();
      }
    }
  }
});

test('an answered offer, explicit fresh reset or disabled prop suppresses onboarding', () => {
  let h = rig();
  saveTutorialOffered(openStore(settingsId));
  writes.length = 0;
  try {
    assert.match(text(h.launch()), /Home fixture/);
    assert.deepEqual(writes, []);
  } finally {
    unmount();
  }
  h = rig();
  openStore(gameId).set('legacy-skipped.v1', 'yes');
  writes.length = 0;
  try {
    assert.match(text(h.launch()), /Home fixture/);
    assert.deepEqual(writes, []);
  } finally {
    unmount();
  }
  h = rig();
  try {
    assert.match(text(h.launch(false)), /Home fixture/);
    assert.deepEqual(writes, []);
  } finally {
    unmount();
  }
});

test('failed writes keep the offer retryable; background presses cannot answer it', () => {
  const h = rig();
  try {
    const root = h.launch();
    act(() => h.activity.setActive(false));
    send('enter');
    assert.deepEqual(writes, []);
    act(() => h.activity.setActive(true));
    failWrite = true;
    send('enter');
    assert.match(text(root), /Could not remember your choice/);
    assert.equal(h.learned(), 0);
    assert.equal(readTutorialOffered(openStore(settingsId)), false);
    failWrite = false;
    send('enter');
    assert.equal(h.learned(), 1);
    assert.equal(writes.length, 1);
  } finally {
    unmount();
  }
});

test('a failed startup read does not classify existing data as a new install', () => {
  const h = rig();
  failRead = true;
  try {
    assert.match(text(h.launch()), /Home fixture/);
    assert.deepEqual(writes, []);
  } finally {
    unmount();
  }
});

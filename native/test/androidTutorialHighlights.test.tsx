import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { test } from 'node:test';
import React from 'react';
import { createActivity } from '../src/activity';
import { Board } from '../src/Board';
import { HIGHLIGHT_CHOICES, saveHighlights } from '../src/highlightsSetting';
import type { KeyValueStore } from '../src/keyValueStore';
import { mount, unmount, send, silentSounds } from './support';

const values = new Map<string, string>();
const reads: string[] = [];
const writes: string[] = [];
const store: KeyValueStore = {
  getString: (key) => values.get(key),
  set: (key, value) => values.set(key, value),
  delete: (key) => values.delete(key),
};
const port = Symbol.for('android-tutorial-highlights-test');
Reflect.set(globalThis, port, {
  openStore(id: string) {
    reads.push(id);
    return {
      getString: store.getString,
      set(key: string) {
        writes.push(key);
        throw new Error('Tutorial must not write preferences or games');
      },
      delete(key: string) {
        writes.push(key);
        throw new Error('Tutorial must not delete preferences or games');
      },
    };
  },
  voice: silentSounds(),
});
registerHooks({
  /** Mount Android's wrapper with real tutorial/board code and only host adapters replaced. */
  resolve(specifier, context, nextResolve) {
    if (context.parentURL?.includes('/android-probe/')) {
      if (specifier === 'react' || specifier.startsWith('react/'))
        return nextResolve(specifier, {
          ...context,
          parentURL: import.meta.url,
        });
      const code =
        specifier === './store'
          ? "export const createStore = (id) => globalThis[Symbol.for('android-tutorial-highlights-test')].openStore(id);"
          : specifier === './useAndroidVoice'
            ? "export const useAndroidVoice = () => globalThis[Symbol.for('android-tutorial-highlights-test')].voice;"
            : specifier === './RemoteSurface'
              ? 'export const RemoteSurface = ({children}) => children;'
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
// Android is typechecked with its own platform dependencies, independently of Vega.
const url = new URL('../../android-probe/src/LearnToPlay.tsx', import.meta.url);
const { LearnToPlay } = (await import(url.href)) as {
  LearnToPlay: React.ComponentType<{
    activity: ReturnType<typeof createActivity>;
    onExit: () => void;
  }>;
};

test('Android tutorial reads every saved Highlights choice on entry and retains it through real lesson input', () => {
  for (const choice of HIGHLIGHT_CHOICES) {
    saveHighlights(store, choice);
    reads.length = 0;
    writes.length = 0;
    let exits = 0;
    const tree = mount(
      <LearnToPlay activity={createActivity(true)} onExit={() => exits++} />,
    );
    try {
      assert.equal(
        tree.root.findByType(Reflect.get(Board, 'type')).props.highlights,
        choice,
      );
      send('enter', 'enter', 'down', 'back', 'back');
      assert.equal(
        tree.root.findByType(Reflect.get(Board, 'type')).props.highlights,
        choice,
      );
      assert.equal(exits, 1);
      assert.deepEqual(reads, ['dicechess-android-settings']);
      assert.deepEqual(writes, []);
    } finally {
      unmount();
    }
  }
});

test('Android tutorial defaults to Standard for missing or invalid Highlights without repairing storage', () => {
  for (const raw of [undefined, 'invalid']) {
    values.clear();
    if (raw) values.set('dicechess-tv.highlights.v1', raw);
    writes.length = 0;
    const before = [...values];
    const tree = mount(
      <LearnToPlay activity={createActivity(true)} onExit={() => {}} />,
    );
    try {
      assert.equal(
        tree.root.findByType(Reflect.get(Board, 'type')).props.highlights,
        'standard',
      );
      assert.deepEqual([...values], before);
      assert.deepEqual(writes, []);
    } finally {
      unmount();
    }
  }
});

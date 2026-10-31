import assert from 'node:assert/strict';
import { test } from 'node:test';
import { registerHooks } from 'node:module';
import React from 'react';
import { act } from 'react-test-renderer';
import { mount, unmount } from './support';
import { hold, release, press } from './stubs/react-native-kepler.mjs';
import { MMKV } from './stubs/react-native-mmkv.mjs';
import { createActivity } from '../src/activity';

// Mount the real Android component; replace only its storage and focus adapter.
const storeUrl = new URL('./stubs/react-native-mmkv.mjs', import.meta.url).href;
registerHooks({
  /** Share the renderer React instance and replace only Android host adapters. */
  resolve(specifier, context, nextResolve) {
    if (context.parentURL?.includes('/android-probe/')) {
      if (specifier === 'react' || specifier.startsWith('react/'))
        return nextResolve(specifier, {
          ...context,
          parentURL: import.meta.url,
        });
      const code =
        specifier === './store'
          ? `import { MMKV } from ${JSON.stringify(storeUrl)}; export const createStore = () => new MMKV();`
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
// Load the platform fixture through the runtime adapters above. A literal
// TypeScript import would pull Android's dependency graph into Vega's tsc job.
// Android CI typechecks this component with its own platform dependencies.
const settingsUrl = new URL(
  '../../android-probe/src/Settings.tsx',
  import.meta.url,
);
const { Settings } = (await import(settingsUrl.href)) as {
  Settings: React.ComponentType<{
    activity: ReturnType<typeof createActivity>;
    onExit: () => void;
  }>;
};

test('Android settings route batched repeats and value keys before React commits', () => {
  act(() => {
    mount(<Settings activity={createActivity(true)} onExit={() => {}} />);
  });
  const store = new MMKV();
  try {
    // One act batch prevents a render between navigation and the value event.
    act(() => {
      hold('down', 4);
      release('down');
      press('right');
    });
    assert.equal(store.getString('dicechess-tv.autoSelect.v1'), 'on');
    assert.equal(store.getString('dicechess-tv.highlights.v1'), undefined);
    assert.equal(store.getString('sound.v1'), undefined);
    act(() => {
      hold('up', 9);
      release('up');
      press('left');
    });
    assert.equal(
      store.getString('dicechess-tv.highlights.v1'),
      'high-contrast',
    );
    assert.equal(store.getString('dicechess-tv.autoSelect.v1'), 'on');
    assert.equal(store.getString('sound.v1'), undefined);
    act(() => {
      hold('down', 2);
      release('down');
      press('right');
    });
    assert.equal(store.getString('dicechess-tv.playAs.v1'), 'w');
    assert.equal(store.getString('dicechess-tv.turnBoard.v1'), undefined);
    assert.equal(store.getString('dicechess-tv.autoSelect.v1'), 'on');
    assert.equal(
      store.getString('dicechess-tv.highlights.v1'),
      'high-contrast',
    );
    act(() => {
      hold('down', 2);
      release('down');
      press('right');
    });
    assert.equal(store.getString('dicechess-tv.host.v1'), 'rolly');
    assert.equal(store.getString('dicechess-tv.turnBoard.v1'), undefined);
    act(() => {
      hold('down', 3);
      release('down');
      press('select');
    });
    assert.deepEqual(JSON.parse(store.getString('voices.v1')!), {
      on: false,
      volume: 10,
    });
    act(() => {
      hold('up', 2);
      release('up');
      press('select');
    });
    assert.deepEqual(JSON.parse(store.getString('music.v1')!), {
      on: false,
      volume: 7,
    });
  } finally {
    unmount();
  }
});

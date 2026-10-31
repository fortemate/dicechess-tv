import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { registerHooks } from 'node:module';
import React from 'react';
import { act } from 'react-test-renderer';
import { createActivity } from '../src/activity';
import type { KeyValueStore } from '../src/keyValueStore';
import type { Music } from '../src/audio';
import { mount, unmount, send, text, silentMusic } from './support';
import { focusedLabel } from './options';
import { MENU_OPTION, FRESH_OPTION, RECOVERY_TITLE } from '../src/Recovery';
import { pressBack } from './stubs/react-native-kepler.mjs';

const reactUrl = import.meta.resolve('react');
const activityUrl = new URL('../src/activity.ts', import.meta.url).href;
registerHooks({
  /** Use the native renderer and replace only Android storage/focus adapters. */
  resolve(specifier, context, nextResolve) {
    if (context.parentURL?.includes('/android-probe/')) {
      if (specifier === 'react' || specifier.startsWith('react/'))
        return nextResolve(specifier, {
          ...context,
          parentURL: import.meta.url,
        });
      const code =
        specifier === './store'
          ? 'export const createStore = () => { throw new Error("Unexpected default storage access"); };'
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
// Dynamic fixture URLs keep Android dependencies out of the native CI typecheck.
const boundaryUrl = new URL(
  '../../android-probe/src/RecoveryBoundary.tsx',
  import.meta.url,
);
const contextUrl = new URL(
  '../../android-probe/src/MusicContext.ts',
  import.meta.url,
);
const { RecoveryBoundary } = (await import(boundaryUrl.href)) as {
  RecoveryBoundary: React.ComponentType<{
    activity: ReturnType<typeof createActivity>;
    onFailure(): void;
    onRecover(): void;
    openStore(): KeyValueStore;
    children: React.ReactNode;
  }>;
};
const { MusicContext } = (await import(contextUrl.href)) as {
  MusicContext: React.Context<{
    music: Music;
    setting: { on: boolean; volume: number };
    apply(): void;
  }>;
};

/** Suppress only the intentional render failure; retain the renderer's other guards. */
function quiet(t: TestContext) {
  const log = console.error;
  t.mock.method(console, 'error', (...args: unknown[]) => {
    if (
      args.some(
        (arg) =>
          String(arg).includes('fixture render failure') ||
          String(arg).startsWith('The above error occurred'),
      )
    )
      return;
    log(...args);
  });
}

/** Mount the real Android boundary with an observable save, services and recovery owner. */
function rig(t: TestContext) {
  quiet(t);
  const values = new Map([
    ['game.v1', 'exact saved partial turn'],
    ['legacy-sentinel', 'retained'],
    ['settings-sentinel', 'retained'],
  ]);
  const writes: string[] = [];
  let failWrite = false,
    failDelete = false;
  const store: KeyValueStore = {
    getString: (key) => values.get(key),
    set(key, value) {
      if (failWrite) throw new Error('write unavailable');
      writes.push(key);
      values.set(key, value);
    },
    delete(key) {
      if (failDelete) throw new Error('delete unavailable');
      writes.push('delete:' + key);
      values.delete(key);
    },
  };
  const activity = createActivity(true);
  const roles: unknown[] = [],
    suspensions: boolean[] = [];
  const music = {
    ...silentMusic(),
    setRole: (role: unknown) => roles.push(role),
    setSuspended: (on: boolean) => suspensions.push(on),
  };
  let fail!: () => void;
  let failures = 0,
    recovered = 0,
    disposed = 0;
  function Content({ broken }: { broken: boolean }) {
    React.useEffect(
      () => () => {
        disposed++;
      },
      [],
    );
    if (broken) throw new Error('fixture render failure');
    return null;
  }
  function Root() {
    const [broken, setBroken] = React.useState(false);
    fail = () => {
      act(() => setBroken(true));
    };
    return (
      <MusicContext.Provider
        value={{ music, setting: { on: true, volume: 7 }, apply() {} }}
      >
        <RecoveryBoundary
          activity={activity}
          openStore={() => store}
          onFailure={() => {
            failures++;
          }}
          onRecover={() => {
            recovered++;
            setBroken(false);
          }}
        >
          <Content broken={broken} />
        </RecoveryBoundary>
      </MusicContext.Provider>
    );
  }
  let rendered!: ReturnType<typeof mount>;
  act(() => {
    rendered = mount(<Root />);
  });
  return {
    values,
    writes,
    roles,
    suspensions,
    activity,
    fail: () => fail(),
    root: rendered.root,
    failWrite: (on: boolean) => {
      failWrite = on;
    },
    failDelete: (on: boolean) => {
      failDelete = on;
    },
    counts: () => ({ failures, recovered, disposed }),
  };
}

test('Android fallback disposes the failed child, silences music, keeps the save and returns home by default', (t) => {
  const h = rig(t);
  try {
    h.fail();
    assert.match(text(h.root), new RegExp(RECOVERY_TITLE));
    assert.equal(focusedLabel(h.root), MENU_OPTION);
    assert.deepEqual(h.roles, [null]);
    assert.deepEqual(h.suspensions, [true]);
    assert.equal(h.counts().disposed, 1);
    send('enter');
    assert.equal(h.counts().recovered, 1);
    assert.equal(h.values.get('game.v1'), 'exact saved partial turn');
    assert.deepEqual(h.writes, []);
    assert.equal(h.roles.at(-1), 'menu');
    assert.equal(h.suspensions.at(-1), false);
    assert.doesNotMatch(text(h.root), new RegExp(RECOVERY_TITLE));
  } finally {
    unmount();
  }
});

test('only confirmed Start fresh clears the current slot and suppresses retained legacy re-import', (t) => {
  const h = rig(t);
  try {
    h.fail();
    send('down');
    assert.equal(focusedLabel(h.root), FRESH_OPTION);
    assert.equal(h.values.get('game.v1'), 'exact saved partial turn');
    act(() => {
      send('enter');
      send('enter');
    });
    assert.equal(h.values.get('game.v1'), undefined);
    assert.equal(h.values.get('legacy-skipped.v1'), 'yes');
    assert.equal(h.values.get('legacy-sentinel'), 'retained');
    assert.equal(h.values.get('settings-sentinel'), 'retained');
    assert.deepEqual(h.writes, ['legacy-skipped.v1', 'delete:game.v1']);
    assert.equal(h.counts().recovered, 1);
  } finally {
    unmount();
  }
});

test('failed reset writes or deletion keep Recovery retryable without overwriting the game', (t) => {
  const h = rig(t);
  try {
    h.failWrite(true);
    h.fail();
    send('down', 'enter');
    assert.equal(h.counts().recovered, 0);
    assert.deepEqual(h.writes, []);
    assert.equal(h.values.get('game.v1'), 'exact saved partial turn');
    assert.match(text(h.root), /Could not reset/);
    assert.equal(focusedLabel(h.root), MENU_OPTION);
    h.failWrite(false);
    h.failDelete(true);
    send('down', 'enter');
    assert.equal(h.counts().recovered, 0);
    assert.equal(h.values.get('game.v1'), 'exact saved partial turn');
    send('enter');
    assert.equal(h.counts().recovered, 1);
    assert.equal(h.values.get('game.v1'), 'exact saved partial turn');
  } finally {
    unmount();
  }
});

test('Recovery respects background input gating and delegates Back to Android without resetting data', (t) => {
  const h = rig(t);
  try {
    h.fail();
    assert.equal(pressBack(), false);
    act(() => h.activity.setActive(false));
    send('down', 'enter');
    assert.equal(h.counts().recovered, 0);
    assert.deepEqual(h.writes, []);
    act(() => h.activity.setActive(true));
    send('enter');
    assert.equal(h.counts().recovered, 1);
    assert.equal(h.values.get('game.v1'), 'exact saved partial turn');
  } finally {
    unmount();
  }
});

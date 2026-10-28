import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath, URL as NodeURL } from 'node:url';
import { buildSync } from 'esbuild';
import React from 'react';
import { act } from 'react-test-renderer';
import { createRemoteChannel, RemoteInputContext } from '../src/remoteInput';
import { useRemoteInput } from '../src/useRemoteInput';
import { useVegaRemote, vegaRemoteEvent } from '../src/vegaRemote';
import { mount, unmount } from './support';
import {
  hold,
  release,
  pressBack,
  hasExited,
  listenerCount,
} from './stubs/react-native-kepler.mjs';

test('Vega maps every supported transition and drops Back and unknown input', () => {
  for (const [raw, key] of [
    ['up', 'up'],
    ['down', 'down'],
    ['left', 'left'],
    ['right', 'right'],
    ['select', 'select'],
    ['enter', 'select'],
    ['kpenter', 'select'],
    ['menu', 'menu'],
  ]) {
    assert.deepEqual(vegaRemoteEvent({ eventType: raw, eventKeyAction: 0 }), {
      key,
      phase: 'down',
    });
    assert.deepEqual(vegaRemoteEvent({ eventType: raw, eventKeyAction: 1 }), {
      key,
      phase: 'up',
    });
  }
  for (const event of [
    {},
    { eventType: 'back', eventKeyAction: 0 },
    { eventType: 'playpause', eventKeyAction: 1 },
    { eventType: 'constructor', eventKeyAction: 0 },
    { eventType: 'select' },
    { eventType: 'right', eventKeyAction: 2 },
  ])
    assert.equal(vegaRemoteEvent(event), null);
});

test('channel subscriptions are independent, removable and ordered for Back', () => {
  const channel = createRemoteChannel();
  const keys: string[] = [];
  const listener = (event: { key: string }) => keys.push(event.key);
  const first = channel.input.subscribe(listener);
  const second = channel.input.subscribe(listener);
  channel.emit({ key: 'left', phase: 'down' });
  first();
  first();
  channel.emit({ key: 'right', phase: 'down' });
  second();
  channel.emit({ key: 'up', phase: 'down' });
  assert.deepEqual(keys, ['left', 'left', 'right']);

  const calls: string[] = [];
  const removeBase = channel.input.subscribeBack(() => {
    calls.push('base');
    return true;
  });
  const removeOverlay = channel.input.subscribeBack(() => {
    calls.push('overlay');
    return false;
  });
  const removeModal = channel.input.subscribeBack(() => {
    calls.push('modal');
    return true;
  });
  assert.equal(channel.back(), true);
  assert.deepEqual(calls, ['modal']);
  removeModal();
  assert.equal(channel.back(), true);
  assert.deepEqual(calls, ['modal', 'overlay', 'base']);
  removeBase();
  removeBase();
  assert.equal(channel.back(), false);
  removeOverlay();
  assert.equal(channel.back(), false);
});

test('a subscriber added during dispatch starts with the next event', () => {
  const channel = createRemoteChannel();
  const events: string[] = [];
  const remove = channel.input.subscribe(() => {
    events.push('first');
    remove();
    channel.input.subscribe(() => events.push('next'));
  });
  channel.emit({ key: 'select', phase: 'up' });
  assert.deepEqual(events, ['first']);
  channel.emit({ key: 'right', phase: 'down' });
  assert.deepEqual(events, ['first', 'next']);
});

test('shared input accepts an independent platform and updates callbacks without resubscribing', () => {
  const channel = createRemoteChannel();
  const events: string[] = [];
  const feedback: boolean[] = [];
  let subscriptions = 0;
  let cleanups = 0;
  const input = {
    ...channel.input,
    subscribe: (listener: Parameters<typeof channel.input.subscribe>[0]) => {
      subscriptions++;
      const remove = channel.input.subscribe(listener);
      return () => {
        cleanups++;
        remove();
      };
    },
  };
  const Probe = ({ label }: { label: string }) => {
    useRemoteInput((key, repeat) => events.push(`${label}:${key}:${repeat}`), {
      onPress: (pressed) => feedback.push(pressed),
    });
    return null;
  };
  const view = (label: string) => (
    <RemoteInputContext.Provider value={input}>
      <Probe label={label} />
    </RemoteInputContext.Provider>
  );
  const tree = mount(view('first'));
  act(() => {
    channel.emit({ key: 'right', phase: 'down' });
    channel.emit({ key: 'select', phase: 'down' });
    channel.emit({ key: 'select', phase: 'down' });
  });
  assert.equal(feedback.at(-1), true);
  act(() => tree.update(view('second')));
  act(() => {
    channel.emit({ key: 'right', phase: 'down' });
    channel.emit({ key: 'right', phase: 'up' });
    channel.emit({ key: 'select', phase: 'up' });
    channel.emit({ key: 'select', phase: 'up' });
    channel.emit({ key: 'menu', phase: 'down' });
    channel.emit({ key: 'menu', phase: 'up' });
    assert.equal(channel.back(), true);
  });
  assert.deepEqual(events, [
    'first:right:false',
    'second:right:true',
    'second:select:false',
    'second:menu:false',
    'second:back:false',
  ]);
  assert.deepEqual(feedback, [false, true, false]);
  assert.equal(subscriptions, 1);
  unmount();
  assert.equal(cleanups, 1);
  assert.equal(channel.back(), false);
  channel.emit({ key: 'down', phase: 'down' });
  assert.equal(events.length, 5);
});

test('one Vega bridge preserves held input and delegates unclaimed Back to native exit', () => {
  const events: string[] = [];
  const Probe = ({ consume }: { consume: boolean }) => {
    useRemoteInput((key, repeat) => events.push(`${key}:${repeat}`), {
      onBack: () => consume,
    });
    return null;
  };
  const Root = ({ consume }: { consume: boolean }) => {
    const input = useVegaRemote();
    return (
      <RemoteInputContext.Provider value={input}>
        <Probe consume={consume} />
      </RemoteInputContext.Provider>
    );
  };
  const tree = mount(<Root consume />);
  assert.equal(listenerCount(), 1);
  act(() => {
    hold('left', 1);
    assert.equal(pressBack(), true);
  });
  assert.equal(hasExited(), false);
  act(() => tree.update(<Root consume={false} />));
  act(() => {
    hold('left', 1);
    release('left');
  });
  assert.deepEqual(events, ['left:false', 'left:true']);
  act(() => assert.equal(pressBack(), false));
  assert.equal(hasExited(), true);
  unmount();
  assert.equal(listenerCount(), 0);
});

test('shared input bundles without platform input APIs', () => {
  const bundled = buildSync({
    absWorkingDir: fileURLToPath(new NodeURL('..', import.meta.url)),
    entryPoints: ['src/useRemoteInput.ts'],
    bundle: true,
    write: false,
    metafile: true,
    packages: 'external',
    platform: 'neutral',
  });
  const inputs = Object.keys(bundled.metafile.inputs);
  assert.ok(inputs.some((path) => path.endsWith('remoteInput.ts')));
  assert.ok(inputs.every((path) => !path.includes('vegaRemote')));
  const imports = Object.values(bundled.metafile.outputs).flatMap(
    (output) => output.imports,
  );
  assert.ok(imports.every((entry) => entry.path === 'react'));
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { useRemoteInput, type RemoteInputOptions } from '../src/useRemoteInput';
import { ActivityContext, createActivity } from '../src/activity';
import type { BoardKey } from '../../src/core/boardInput';
import { mount, unmount } from './support';
import {
  hold,
  release,
  press,
  pressBack,
  hasExited,
  listenerCount,
  tvEvent,
} from './stubs/react-native-kepler.mjs';

type KeyHandler = (key: BoardKey, repeat: boolean) => void;
const open = (
  onKey: KeyHandler,
  options?: RemoteInputOptions,
  activity = createActivity(true),
) => {
  const Probe = () => {
    useRemoteInput(onKey, options);
    return null;
  };
  act(() => {
    mount(
      <ActivityContext.Provider value={activity}>
        <Probe />
      </ActivityContext.Provider>,
    );
  });
};

test('every direction repeats on down, ignores release and starts fresh after release', () => {
  const events: [BoardKey, boolean][] = [];
  open((key, repeat) => events.push([key, repeat]));
  try {
    for (const key of ['up', 'down', 'left', 'right']) {
      act(() => {
        hold(key, 2);
        release(key);
        press(key);
      });
    }
    assert.deepEqual(
      events,
      ['up', 'down', 'left', 'right'].flatMap((key) => [
        [key, false],
        [key, true],
        [key, false],
      ]),
    );
  } finally {
    unmount();
  }
});

test('all three OK names share one physical hold and confirm only one release', () => {
  const events: [BoardKey, boolean][] = [],
    feedback: boolean[] = [];
  open((key, repeat) => events.push([key, repeat]), {
    onPress: (down) => feedback.push(down),
  });
  const aliases = ['select', 'enter', 'kpenter'];
  try {
    for (let i = 0; i < aliases.length; i++) {
      events.length = 0;
      feedback.length = 0;
      act(() => {
        hold(aliases[i], 3);
        hold(aliases[(i + 1) % 3], 1);
        release(aliases[(i + 2) % 3]);
        release(aliases[i]);
      });
      assert.deepEqual(feedback, [true, false]);
      assert.deepEqual(events, [['select', false]]);
    }
  } finally {
    unmount();
  }
});

test('unsupported OK and direction actions leave the physical hold intact and unknown keys do nothing', () => {
  const events: [BoardKey, boolean][] = [],
    feedback: boolean[] = [];
  open((key, repeat) => events.push([key, repeat]), {
    onPress: (down) => feedback.push(down),
  });
  feedback.length = 0;
  try {
    act(() => {
      press('playpause');
      press('UP');
      tvEvent({});
      tvEvent({ eventType: 'enter', eventKeyAction: 2 });
      tvEvent({ eventType: 'enter' });
      hold('select', 1);
      tvEvent({ eventType: 'kpenter', eventKeyAction: 2 });
      tvEvent({ eventType: 'select' });
      release('enter');
      hold('right', 1);
      tvEvent({ eventType: 'right', eventKeyAction: 2 });
      hold('right', 1);
      release('right');
      press('right');
    });
    assert.deepEqual(feedback, [true, false]);
    assert.deepEqual(events, [
      ['select', false],
      ['right', false],
      ['right', true],
      ['right', false],
    ]);
  } finally {
    unmount();
  }
});

test('Menu dispatches active releases without an OK hold or pressed feedback', () => {
  const events: [BoardKey, boolean][] = [],
    feedback: boolean[] = [];
  const activity = createActivity(true);
  open(
    (key, repeat) => events.push([key, repeat]),
    { onPress: (down) => feedback.push(down) },
    activity,
  );
  feedback.length = 0;
  try {
    act(() => {
      release('menu');
      hold('menu', 3);
      tvEvent({ eventType: 'menu', eventKeyAction: 2 });
      release('menu');
      release('menu');
    });
    assert.deepEqual(events, [
      ['menu', false],
      ['menu', false],
      ['menu', false],
    ]);
    assert.deepEqual(feedback, []);
    act(() => {
      activity.setActive(false);
      release('menu');
      activity.setActive(true);
      release('menu');
    });
    assert.equal(events.length, 4);
    assert.deepEqual(events[3], ['menu', false]);
  } finally {
    unmount();
  }
});

test('Back without a separate callback dispatches back and claims it, while an inactive hook only claims it', () => {
  const events: [BoardKey, boolean][] = [];
  const activity = createActivity(true);
  open((key, repeat) => events.push([key, repeat]), undefined, activity);
  try {
    act(() => assert.equal(pressBack(), true));
    assert.deepEqual(events, [['back', false]]);
    assert.equal(hasExited(), false);
    act(() => {
      activity.setActive(false);
      assert.equal(pressBack(), true);
    });
    assert.equal(events.length, 1);
    act(() => {
      activity.setActive(true);
      assert.equal(pressBack(), true);
    });
    assert.deepEqual(events, [
      ['back', false],
      ['back', false],
    ]);
    assert.equal(hasExited(), false);
  } finally {
    unmount();
  }
});

test('a held OK and Back use the latest committed callbacks without multiplying subscriptions', () => {
  const events: string[] = [];
  const Probe = ({ name }: { name: string }) => {
    useRemoteInput(
      (key, repeat) => events.push(`${name}:key:${key}:${repeat}`),
      {
        onPress: (down) => events.push(`${name}:press:${down}`),
        onBack: () => {
          events.push(`${name}:back`);
          return true;
        },
      },
    );
    return null;
  };
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = mount(<Probe name="old" />);
  });
  events.length = 0;
  try {
    act(() => hold('enter', 1));
    act(() => tree.update(<Probe name="new" />));
    assert.equal(listenerCount(), 1);
    act(() => {
      release('kpenter');
      assert.equal(pressBack(), true);
    });
    assert.deepEqual(events, [
      'old:press:true',
      'new:press:false',
      'new:key:select:false',
      'new:back',
    ]);
  } finally {
    unmount();
  }
});

test('synchronous foreground loss in OK release feedback cancels dispatch and unmount removes both channels', () => {
  const events: string[] = [];
  const activity = createActivity(true);
  let cancel = false;
  open(
    (key, repeat) => events.push(`key:${key}:${repeat}`),
    {
      onPress: (down) => {
        events.push(`press:${down}`);
        if (!down && cancel) activity.setActive(false);
      },
    },
    activity,
  );
  events.length = 0;
  try {
    act(() => hold('select', 1));
    cancel = true;
    act(() => release('select'));
    assert.deepEqual(events, ['press:true', 'press:false', 'press:false']);
    cancel = false;
    act(() => {
      activity.setActive(true);
      press('select');
    });
    assert.deepEqual(events.slice(-3), [
      'press:true',
      'press:false',
      'key:select:false',
    ]);
  } finally {
    unmount();
  }
  assert.equal(listenerCount(), 0);
  act(() => assert.equal(pressBack(), false));
  assert.equal(hasExited(), true);
});

// Turns Vega remote events into the board's own key vocabulary.
//
// This is the whole platform surface of the input path: everything downstream
// is the pure reducer in src/core/boardInput.ts.
//
// Vega splits input across channels and each has one job here.
//
// `useTVEventHandler` observes key events and carries the directions and OK. It
// cannot claim an event, which is fine for those and fatal for Back: an
// unclaimed Back closes the app, so a Back seen only here would cancel nothing
// and quit instead.
//
// `useKeplerBackHandler` exists for exactly that. It claims Back through the
// consuming channel and calls `exitApp()` itself when nothing handles it, so
// returning false from the handler is how the app agrees to close rather than a
// failure to react.
//
// Two channels that were tried and rejected: `UserInputManager.addListener`
// aborts the JS thread on 0.24, and subscribing `useAddUserInputListenerCallback`
// to every key delivers nothing while `useTVEventHandler` is also mounted.
import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import {
  useTVEventHandler,
  useKeplerBackHandler,
  type HWEvent,
} from '@amazon-devices/react-native-kepler';
import type { BoardKey } from '../../src/core/boardInput';

// OK arrives under three names, and all of them mean the same to the board:
// `select` from a physical remote, as Amazon documents it; `enter` from the
// Virtual Device's keyboard; and `kpenter` from the Virtual Device's on-screen
// remote, whose skin binds OK to the keypad Enter key (KEY_KPENTER). The last
// one was missed until the owner pressed OK on that remote and nothing happened.
// Back is absent on purpose: it arrives on the other channel.
const KEYS: Readonly<Record<string, BoardKey>> = {
  up: 'up',
  down: 'down',
  left: 'left',
  right: 'right',
  select: 'select',
  enter: 'select',
  kpenter: 'select',
};

// Directions repeat while the button is held, which is how a cursor should walk
// a board. Select must not, or one press of OK would play several actions.
const REPEATABLE: ReadonlySet<BoardKey> = new Set([
  'up',
  'down',
  'left',
  'right',
]);

// eventKeyAction is 0 when the button goes down and on every repeat while it is
// held, and 1 once when it is released.
const DOWN = 0;
const UP = 1;

export type RemoteInputOptions = {
  // Whether the app handled Back. Returning false lets the system do what Back
  // means at the top of an app, which is to close it — the behaviour a TV
  // viewer expects, and not something to suppress.
  onBack?: () => boolean;
};

export function useRemoteInput(
  onKey: (key: BoardKey) => void,
  options: RemoteInputOptions = {},
): void {
  // Reading the handlers through refs keeps a new callback identity on every
  // render from resubscribing mid-press. The refs are updated once a render has
  // been committed, not while it runs: a render can be thrown away, and a key
  // must never reach a handler from one that was. Layout effects run before any
  // subscription below is made, so no key can arrive before they are set.
  const handler = useRef(onKey);
  const back = useRef(options.onBack);
  useLayoutEffect(() => {
    handler.current = onKey;
    back.current = options.onBack;
  });

  useTVEventHandler(
    useCallback((event: HWEvent) => {
      const key = KEYS[String(event.eventType)];
      if (!key) return;
      const wanted = REPEATABLE.has(key) ? DOWN : UP;
      if (event.eventKeyAction === wanted) handler.current(key);
    }, []),
  );

  const backHandler = useKeplerBackHandler();
  useEffect(() => {
    const subscription = backHandler.addEventListener(
      'hardwareBackPress',
      () => {
        // No handler means the screen has nowhere to go back to, and the app
        // should close.
        if (!back.current) {
          handler.current('back');
          return true;
        }
        return back.current();
      },
    );
    return () => subscription.remove();
  }, [backHandler]);
}

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
  useKeplerAppStateManager,
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
  menu: 'menu',
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
  // Whether OK is held down: true when it goes down, false when it comes up,
  // just before the press is delivered. A screen shows its focused item pressed
  // meanwhile, so the press is seen before its choice takes effect (#51).
  onPress?: (pressed: boolean) => void;
  // A different input context (board phase, selection or overlay) forgets a
  // held press. Cursor movement itself must not change this token.
  scope?: string;
};

export function useRemoteInput(
  onKey: (key: BoardKey, repeat: boolean) => void,
  options: RemoteInputOptions = {},
): void {
  // Reading the handlers through refs keeps a new callback identity on every
  // render from resubscribing mid-press. The refs are updated once a render has
  // been committed, not while it runs: a render can be thrown away, and a key
  // must never reach a handler from one that was. Layout effects run before any
  // subscription below is made, so no key can arrive before they are set.
  const held = useRef(new Set<BoardKey>());
  const selectHeld = useRef(false);
  const ready = useRef(true);
  const handler = useRef(onKey);
  const back = useRef(options.onBack);
  const press = useRef(options.onPress);
  useLayoutEffect(() => {
    handler.current = onKey;
    back.current = options.onBack;
    press.current = options.onPress;
  });

  const reset = useCallback(() => {
    held.current.clear();
    selectHeld.current = false;
    press.current?.(false);
  }, []);
  useLayoutEffect(reset, [reset, options.scope]);

  const appState = useKeplerAppStateManager();
  useEffect(() => {
    let active = appState.getCurrentState() === 'active';
    let focused = true;
    const sync = () => {
      ready.current = active && focused;
      if (!ready.current) reset();
    };
    sync();
    const change = appState.addEventListener('change', (state) => {
      active = state === 'active';
      sync();
    });
    const blur = appState.addEventListener('blur', () => {
      focused = false;
      sync();
    });
    const focus = appState.addEventListener('focus', () => {
      focused = true;
      sync();
    });
    return () => {
      change.remove();
      blur.remove();
      focus.remove();
    };
  }, [appState, reset]);

  useTVEventHandler(
    useCallback((event: HWEvent) => {
      const key = KEYS[String(event.eventType)];
      if (!key || !ready.current) return;
      if (REPEATABLE.has(key)) {
        if (event.eventKeyAction === UP) held.current.delete(key);
        if (event.eventKeyAction !== DOWN) return;
        const repeat = held.current.has(key);
        held.current.add(key);
        handler.current(key, repeat);
        return;
      }
      if (key === 'select') {
        // Down, and every repeat while held, only shows the press; the release
        // is the press itself, delivered once.
        if (event.eventKeyAction === DOWN) {
          selectHeld.current = true;
          press.current?.(true);
        }
        if (event.eventKeyAction !== UP || !selectHeld.current) return;
        selectHeld.current = false;
        press.current?.(false);
      }
      if (event.eventKeyAction === UP) handler.current(key, false);
    }, []),
  );

  const backHandler = useKeplerBackHandler();
  useEffect(() => {
    const subscription = backHandler.addEventListener(
      'hardwareBackPress',
      () => {
        // Inactive input must also claim Back: letting it fall through would
        // invoke the platform's default app exit while another surface owns it.
        if (!ready.current) return true;
        // No handler means the screen has nowhere to go back to, and the app
        // should close.
        if (!back.current) {
          handler.current('back', false);
          return true;
        }
        return back.current();
      },
    );
    return () => subscription.remove();
  }, [backHandler]);
}

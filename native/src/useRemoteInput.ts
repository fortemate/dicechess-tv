// Turns Vega remote events into the board's own key vocabulary.
//
// This is the whole platform surface of the input path: everything downstream
// is the pure reducer in src/core/boardInput.ts.
//
// Vega offers two input channels and only one of them works here. The static
// UserInputManager.addListener registers through the pathway that takes no root
// tag and aborts the JS thread outright. useAddUserInputListenerCallback
// subscribes without error but never delivers an event. useTVEventHandler, the
// documented hook, is the one that fires; it is what this uses.
import { useCallback, useRef } from 'react';
import {
  useTVEventHandler,
  type HWEvent,
} from '@amazon-devices/react-native-kepler';
import type { BoardKey } from '../../src/core/boardInput';

// A keyboard on the Virtual Device reports the OK button as `enter`; a physical
// remote reports `select`. Both mean the same thing to the board.
const KEYS: Readonly<Record<string, BoardKey>> = {
  up: 'up',
  down: 'down',
  left: 'left',
  right: 'right',
  select: 'select',
  enter: 'select',
  back: 'back',
};

// Directions repeat while the button is held, which is how a cursor should walk
// a board. Select and back must not, or one press of OK would play several
// actions.
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

export function useRemoteInput(onKey: (key: BoardKey) => void): void {
  // Reading the handler through a ref keeps a new callback identity on every
  // render from resubscribing mid-press.
  const handler = useRef(onKey);
  handler.current = onKey;

  useTVEventHandler(
    useCallback((event: HWEvent) => {
      const key = KEYS[String(event.eventType)];
      if (!key) return;
      const wanted = REPEATABLE.has(key) ? DOWN : UP;
      if (event.eventKeyAction === wanted) handler.current(key);
    }, []),
  );
}

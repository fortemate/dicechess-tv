// Turns Vega remote events into the board's own key vocabulary.
//
// This is the whole platform surface of the input path: everything downstream
// is the pure reducer in src/core/boardInput.ts. Vega's event names already
// match that vocabulary, so nothing is translated beyond lower-casing.
import { useEffect, useRef } from 'react';
import {
  useAddUserInputListenerCallback,
  UserInputEventName,
} from '@amazon-devices/react-native-kepler';
import type { BoardKey } from '../../src/core/boardInput';

const KEYS: ReadonlyArray<readonly [UserInputEventName, BoardKey]> = [
  [UserInputEventName.Up, 'up'],
  [UserInputEventName.Down, 'down'],
  [UserInputEventName.Left, 'left'],
  [UserInputEventName.Right, 'right'],
  [UserInputEventName.Select, 'select'],
  [UserInputEventName.Back, 'back'],
];

export function useRemoteInput(onKey: (key: BoardKey) => void): void {
  // Subscribing once and reading the handler through a ref keeps a new callback
  // identity on every render from tearing the listeners down mid-press.
  const handler = useRef(onKey);
  handler.current = onKey;
  // The hook form is the one that works on a device: it registers through the
  // root tag from React context. The static UserInputManager.addListener takes
  // the pathway without one and aborts the JS thread on Vega 0.24.
  const addListener = useAddUserInputListenerCallback();

  useEffect(() => {
    const subscriptions = KEYS.map(([name, key]) =>
      addListener(name, (event) => {
        // A held button repeats PRESSED and ends with one RELEASED; acting on
        // the press alone keeps one button press to one board action.
        if (event.phase === 'PRESSED') handler.current(key);
        return true;
      }),
    );
    return () => {
      for (const subscription of subscriptions) subscription.remove();
    };
  }, [addListener]);
}

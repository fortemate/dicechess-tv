// Stand-in for @amazon-devices/react-native-kepler in Node. The tests drive the
// input path by delivering HW events to the registered handler, the same shape
// the device sends: a lower-case eventType and eventKeyAction 0 down, 1 up.
import { useEffect } from 'react';

let handler = null;

export function useTVEventHandler(callback) {
  useEffect(() => {
    handler = callback;
    return () => {
      if (handler === callback) handler = null;
    };
  }, [callback]);
}

// Test-only: one full press, down then up.
export function press(eventType) {
  if (!handler) throw new Error('No TV event handler registered');
  handler({ eventType, eventKeyAction: 0 });
  handler({ eventType, eventKeyAction: 1 });
}

// Test-only: hold a button, repeating the down event without releasing it.
export function hold(eventType, repeats = 2) {
  if (!handler) throw new Error('No TV event handler registered');
  for (let i = 0; i < repeats; i++) {
    handler({ eventType, eventKeyAction: 0 });
  }
}

export function isSubscribed() {
  return handler !== null;
}

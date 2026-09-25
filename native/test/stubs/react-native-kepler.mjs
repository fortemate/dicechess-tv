// Stand-in for @amazon-devices/react-native-kepler in Node. The tests drive the
// input path by delivering HW events to every registered handler, the same
// shape the device sends: a lower-case eventType and eventKeyAction 0 down,
// 1 up.
//
// Every handler, not the last one: on a device two mounted screens both receive
// a press, and a stub that kept only one would hide a screen that forgot to
// stop listening.
import { useEffect } from 'react';

const handlers = new Set();

export function useTVEventHandler(callback) {
  useEffect(() => {
    handlers.add(callback);
    return () => {
      handlers.delete(callback);
    };
  }, [callback]);
}

const deliver = (event) => {
  if (!handlers.size) throw new Error('No TV event handler registered');
  for (const handler of [...handlers]) handler(event);
};

// Test-only: one full press, down then up.
export function press(eventType) {
  deliver({ eventType, eventKeyAction: 0 });
  deliver({ eventType, eventKeyAction: 1 });
}

// Test-only: hold a button, repeating the down event without releasing it.
export function hold(eventType, repeats = 2) {
  for (let i = 0; i < repeats; i++) {
    deliver({ eventType, eventKeyAction: 0 });
  }
}

// Back does not arrive on the TV event channel: Vega routes it through a hook
// of its own, which claims the press so the system does not close the app.
const backSubscriptions = [];

// One instance, as the real hook memoises per root tag. An object rebuilt every
// render would resubscribe every render, and the order of handlers — which is
// what decides who claims a press — would follow render order instead of mount
// order.
const keplerBackHandler = {
  exitApp() {
    exited = true;
  },
  addEventListener(_name, handler) {
    backSubscriptions.push(handler);
    return {
      remove() {
        const at = backSubscriptions.indexOf(handler);
        if (at !== -1) backSubscriptions.splice(at, 1);
      },
    };
  },
};

export function useKeplerBackHandler() {
  return keplerBackHandler;
}

let exited = false;

// Test-only: press Back. Returns true when the app claimed it; when nothing
// claims it the platform closes the app, which is recorded rather than thrown.
export function pressBack() {
  for (let i = backSubscriptions.length - 1; i >= 0; i--) {
    if (backSubscriptions[i]()) return true;
  }
  exited = true;
  return false;
}

// Test-only: did an unclaimed Back close the app?
export function hasExited() {
  return exited;
}

export function clearExit() {
  exited = false;
}

export function isSubscribed() {
  return handlers.size > 0;
}

// Test-only: how many screens are listening.
export function listenerCount() {
  return handlers.size;
}

// The app-state manager: one shared instance, so an app and a test see the same
// listeners. Test code moves the app between foreground and background.
const appStateListeners = new Set();
let appState = 'active';
const appStateManager = {
  getCurrentState() {
    return appState;
  },
  addEventListener(name, callback) {
    if (name !== 'change') return { remove() {} };
    appStateListeners.add(callback);
    return {
      remove() {
        appStateListeners.delete(callback);
      },
    };
  },
};

export function useKeplerAppStateManager() {
  return appStateManager;
}

// Test-only: the app moves to another state, as Home or the launcher makes it.
export function setAppState(state) {
  appState = state;
  for (const listener of [...appStateListeners]) listener(state);
}

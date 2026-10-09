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

// Back is not delivered here: it has a channel of its own (pressBack, below),
// and the screens ignore it on this one, so a Back sent here would do nothing
// and the test would pass without it.
const deliver = (event) => {
  if (event.eventType === 'back')
    throw new Error('Back does not arrive as a TV event: use pressBack()');
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

// Test-only: let go of a held button.
export function release(eventType) {
  deliver({ eventType, eventKeyAction: 1 });
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
// blur and focus, which Vega sends around a change of state (#76).
const appEventListeners = new Map();
let appState = 'active';
const appStateManager = {
  getCurrentState() {
    return appState;
  },
  addEventListener(name, callback) {
    if (name !== 'change') {
      if (!appEventListeners.has(name)) appEventListeners.set(name, new Set());
      appEventListeners.get(name).add(callback);
      return {
        remove() {
          appEventListeners.get(name).delete(callback);
        },
      };
    }
    appStateListeners.add(callback);
    return {
      remove() {
        appStateListeners.delete(callback);
      },
    };
  },
};

// Test-only: Vega sends blur or focus, as it does just before leaving for the
// launcher and on the way back.
export function appEvent(name) {
  for (const listener of [...(appEventListeners.get(name) ?? [])]) listener();
}

export function useKeplerAppStateManager() {
  return appStateManager;
}

// Test-only: the app moves to another state, as Home or the launcher makes it.
export function setAppState(state) {
  appState = state;
  for (const listener of [...appStateListeners]) listener(state);
}

// Test-only: as the platform is when an app starts: in the foreground, and not
// closed by a Back nobody claimed.
export function resetPlatform() {
  appState = 'active';
  exited = false;
}

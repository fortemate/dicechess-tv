// @amazon-devices/react-native-kepler in the browser: the remote's two input
// channels and the app-state manager, as native/src/ uses them.
//
// The shapes are the device's, as native/src/useRemoteInput.ts describes them:
// a lower-case eventType, eventKeyAction 0 on the way down and on every repeat
// while held, 1 on release; Back on a channel of its own that claims the press.
// ../keyboard.ts turns key presses into these events.
import { useEffect } from 'react';

export type HWEvent = { eventType: string; eventKeyAction: number };

type Handler = (event: HWEvent) => void;

const handlers = new Set<Handler>();

export function useTVEventHandler(callback: Handler): void {
  useEffect(() => {
    handlers.add(callback);
    return () => {
      handlers.delete(callback);
    };
  }, [callback]);
}

// Every mounted handler receives an event, as on a device.
export function deliver(event: HWEvent): void {
  for (const handler of [...handlers]) handler(event);
}

type BackListener = () => boolean;

const backListeners: BackListener[] = [];
let onExit: () => void = () => undefined;

const backHandler = {
  exitApp() {
    onExit();
  },
  addEventListener(_name: 'hardwareBackPress', listener: BackListener) {
    backListeners.push(listener);
    return {
      remove() {
        const at = backListeners.indexOf(listener);
        if (at !== -1) backListeners.splice(at, 1);
      },
    };
  },
};

export function useKeplerBackHandler() {
  return backHandler;
}

// The last listener to subscribe is asked first, and the first to claim Back
// keeps it. When nobody claims it the television closes the app.
export function pressBack(): void {
  for (let i = backListeners.length - 1; i >= 0; i--) {
    if (backListeners[i]()) return;
  }
  backHandler.exitApp();
}

// What the bench shows when Back would have closed the app.
export function onAppExit(callback: () => void): void {
  onExit = callback;
}

// The app-state manager. A hidden tab is the app in the background; the
// browser window losing focus is Vega's blur.
type AppState = 'active' | 'background';
type Subscription = { remove(): void };

const currentState = (): AppState =>
  document.visibilityState === 'hidden' ? 'background' : 'active';

const appStateManager = {
  getCurrentState(): AppState {
    return currentState();
  },
  addEventListener(
    name: 'change' | 'blur' | 'focus',
    callback: (state: AppState) => void,
  ): Subscription {
    if (name === 'change') {
      const listener = () => callback(currentState());
      document.addEventListener('visibilitychange', listener);
      return {
        remove: () =>
          document.removeEventListener('visibilitychange', listener),
      };
    }
    const listener = () => callback(currentState());
    window.addEventListener(name, listener);
    return { remove: () => window.removeEventListener(name, listener) };
  },
};

export function useKeplerAppStateManager() {
  return appStateManager;
}

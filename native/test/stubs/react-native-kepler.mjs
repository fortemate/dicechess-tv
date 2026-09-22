// Stand-in for @amazon-devices/react-native-kepler in Node. The tests drive the
// input path by invoking the registered listeners directly.
export const UserInputEventName = {
  Up: 'UP',
  Down: 'DOWN',
  Left: 'LEFT',
  Right: 'RIGHT',
  Select: 'SELECT',
  Back: 'BACK',
  Menu: 'MENU',
};

const listeners = new Map();

export const useAddUserInputListenerCallback = () => addListener;

function addListener(eventName, callback) {
  listeners.set(eventName, callback);
  return {
    remove() {
      listeners.delete(eventName);
    },
  };
}

export const UserInputManager = {
  addListener,
  removeListeners() {
    listeners.clear();
  },
};

// Test-only: deliver one press for a Vega event name.
export function press(eventName) {
  const callback = listeners.get(eventName);
  if (!callback) throw new Error('No listener for ' + eventName);
  callback({ phase: 'PRESSED' });
}

export function listenerCount() {
  return listeners.size;
}

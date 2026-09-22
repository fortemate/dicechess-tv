// Stand-in for @amazon-devices/react-native-mmkv in Node: the same synchronous
// key-value surface, backed by a Map that lives as long as the process.
const store = new Map();

export class MMKV {
  getString(key) {
    return store.get(key);
  }
  set(key, value) {
    store.set(key, value);
  }
  delete(key) {
    store.delete(key);
  }
}

// Test-only: forget everything, as a fresh install would.
export function reset() {
  store.clear();
}

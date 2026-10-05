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

// The answered offer of the tutorial (#244), as src/tutorialOfferSetting.ts
// stores it; test/tutorialOffer.test.tsx holds the two to the same key.
const OFFER_KEY = 'dicechess-tv.tutorialOffer.v1';

// Test-only: forget everything, as a fresh install would, except that the
// first launch's offer of the tutorial has been answered, since nearly every
// test is about what comes after it. A first launch keeps nothing at all.
export function reset({ firstLaunch = false } = {}) {
  store.clear();
  if (!firstLaunch) store.set(OFFER_KEY, 'answered');
}

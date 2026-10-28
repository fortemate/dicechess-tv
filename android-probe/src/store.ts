import { createMMKV } from 'react-native-mmkv';

// Preserve the existing synchronous port while adapting MMKV v4's API.
export function createStore(id: string) {
  const mmkv = createMMKV({ id });
  return {
    getString: (key: string) => mmkv.getString(key),
    set: (key: string, value: string) => mmkv.set(key, value),
    delete: (key: string) => {
      mmkv.remove(key);
    },
  };
}

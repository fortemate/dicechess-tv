// Vega storage adapter. Default MMKV instances share the existing namespace;
// changing its id would hide games and settings saved by released builds.
import { MMKV } from '@amazon-devices/react-native-mmkv';
import { KeyValueSnapshotStore, type KeyValueStore } from './keyValueStore';

export type { KeyValueStore } from './keyValueStore';

export const openVegaStorage = (): KeyValueStore => new MMKV();

// Keep the existing adapter available to callers that need a standalone store.
export class MmkvSnapshotStore<T> extends KeyValueSnapshotStore<T> {
  constructor(config: {
    key: string;
    decode: (raw: string) => T;
    store?: KeyValueStore;
  }) {
    super({ ...config, store: config.store ?? openVegaStorage() });
  }
}

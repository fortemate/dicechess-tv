// Saving for the native board.
//
// MMKV is synchronous and backed by a memory-mapped file, so a committed write
// survives the process being killed — that was measured on a device before this
// was written. What it does not offer is the web store's explicit strict-
// durability assertion: there is no flag to check, so this store does not claim
// one. It claims what it can show, which is that a value read back after a
// forced restart is the value that was written.
//
// Because writes are synchronous there is no window in which a half-written
// snapshot is visible, and no reason to pause input around a save.
import { MMKV } from '@amazon-devices/react-native-mmkv';
import {
  encodeSnapshot,
  type SnapshotStore,
} from '../../src/core/snapshotStore';

// The minimum of MMKV this store uses, so a test can supply its own.
export type KeyValueStore = {
  getString(key: string): string | undefined;
  set(key: string, value: string): void;
  delete(key: string): void;
};

export class MmkvSnapshotStore<T> implements SnapshotStore<T> {
  private readonly store: KeyValueStore;
  private readonly key: string;
  private readonly decode: (raw: string) => T;

  constructor(config: {
    key: string;
    decode: (raw: string) => T;
    store?: KeyValueStore;
  }) {
    this.store = config.store ?? new MMKV();
    this.key = config.key;
    this.decode = config.decode;
  }

  async load(): Promise<T | null> {
    return this.read();
  }

  // The synchronous read, for callers that must have the saved game before the
  // first render rather than after it.
  read(): T | null {
    const raw = this.store.getString(this.key);
    return raw === undefined ? null : this.decode(raw);
  }

  async save(snapshot: T): Promise<void> {
    // Validate before writing: a damaged snapshot must not replace a good one.
    this.store.set(this.key, encodeSnapshot(snapshot, this.decode));
  }

  clear(): void {
    this.store.delete(this.key);
  }
}

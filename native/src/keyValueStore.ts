import {
  encodeSnapshot,
  type SnapshotStore,
} from '../../src/core/snapshotStore';

// Synchronous string storage. Platform adapters own persistence and durability.
export type KeyValueStore = {
  getString(key: string): string | undefined;
  set(key: string, value: string): void;
  delete(key: string): void;
};

export class KeyValueSnapshotStore<T> implements SnapshotStore<T> {
  private readonly store: KeyValueStore;
  private readonly key: string;
  private readonly decode: (raw: string) => T;

  constructor(config: {
    key: string;
    decode: (raw: string) => T;
    store: KeyValueStore;
  }) {
    this.store = config.store;
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

  // Copies the stored value, unchanged and without decoding it, to another key,
  // so a value that no longer decodes is kept when a save replaces it.
  keepAside(key: string): void {
    const raw = this.store.getString(this.key);
    if (raw !== undefined) this.store.set(key, raw);
  }
}

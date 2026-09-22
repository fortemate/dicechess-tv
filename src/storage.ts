import { decode, STORAGE_KEY, type Snapshot } from './core/model.ts';

export const DATABASE = 'dicechess-tv.probe';
const STORE = 'snapshots';

// A successful request is not a committed transaction. In particular, never
// acknowledge a put before the strict transaction's complete event.
export class SnapshotStore<T> {
  private readonly config: {
    database: string;
    key: string;
    decode: (raw: string) => T;
  };
  private database: Promise<IDBDatabase> | undefined;

  private readonly factory: IDBFactory;

  constructor(
    factory: IDBFactory,
    config: { database: string; key: string; decode: (raw: string) => T },
  ) {
    this.factory = factory;
    this.config = config;
  }

  private open(): Promise<IDBDatabase> {
    if (!this.database) {
      this.database = new Promise<IDBDatabase>((resolve, reject) => {
        const request = this.factory.open(this.config.database, 1);
        let blocked = false;
        request.onupgradeneeded = () => request.result.createObjectStore(STORE);
        request.onblocked = () => {
          blocked = true;
          reject(new Error('Save database is blocked by another window'));
        };
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const database = request.result;
          if (blocked) {
            database.close();
            return;
          }
          database.onversionchange = () => {
            database.close();
            this.database = undefined;
          };
          resolve(database);
        };
      }).catch((error) => {
        this.database = undefined;
        throw error;
      });
    }
    return this.database;
  }

  async load(): Promise<T | null> {
    const database = await this.open();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE, 'readonly');
      const request = transaction.objectStore(STORE).get(this.config.key);
      transaction.onabort = () =>
        reject(transaction.error ?? new Error('Save read aborted'));
      transaction.oncomplete = () => {
        try {
          resolve(
            request.result === undefined
              ? null
              : this.config.decode(request.result),
          );
        } catch (error) {
          reject(error);
        }
      };
    });
  }

  async save(snapshot: T): Promise<void> {
    // Capture and validate before yielding, so the caller cannot mutate a
    // pending write and a damaged snapshot never replaces a valid one.
    const raw = JSON.stringify(snapshot);
    this.config.decode(raw);
    const database = await this.open();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE, 'readwrite', {
        durability: 'strict',
      });
      transaction.onabort = () =>
        reject(transaction.error ?? new Error('Save transaction aborted'));
      transaction.oncomplete = () => resolve();
      if (transaction.durability !== 'strict') {
        reject(new Error('Strict save transactions are unavailable'));
        transaction.abort();
        return;
      }
      transaction.objectStore(STORE).put(raw, this.config.key);
    });
  }

  async restore(legacy: Pick<Storage, 'getItem'>): Promise<T | null> {
    const saved = await this.load();
    if (saved) return saved;
    const raw = legacy.getItem(this.config.key);
    if (raw === null) return null;
    const migrated = this.config.decode(raw);
    await this.save(migrated);
    // Keep the old entry for rollback. IndexedDB is authoritative thereafter,
    // including an explicit reset, so an old game cannot resurrect on restart.
    return migrated;
  }

  async close(): Promise<void> {
    const pending = this.database;
    this.database = undefined;
    if (pending) (await pending).close();
  }
}

// Preserve the original diagnostic database for rollback.
export class SaveStore extends SnapshotStore<Snapshot> {
  constructor(factory: IDBFactory) {
    super(factory, { database: DATABASE, key: STORAGE_KEY, decode });
  }
}

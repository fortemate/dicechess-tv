import { decode, STORAGE_KEY, type Snapshot } from './model.ts';

export const DATABASE = 'dicechess-tv.probe';
const STORE = 'snapshots';

// A successful request is not a committed transaction. In particular, never
// acknowledge a put before the strict transaction's complete event.
export class SaveStore {
  private database: Promise<IDBDatabase> | undefined;

  private readonly factory: IDBFactory;

  constructor(factory: IDBFactory) {
    this.factory = factory;
  }

  private open(): Promise<IDBDatabase> {
    if (!this.database) {
      this.database = new Promise<IDBDatabase>((resolve, reject) => {
        const request = this.factory.open(DATABASE, 1);
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

  async load(): Promise<Snapshot | null> {
    const database = await this.open();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE, 'readonly');
      const request = transaction.objectStore(STORE).get(STORAGE_KEY);
      transaction.onabort = () =>
        reject(transaction.error ?? new Error('Save read aborted'));
      transaction.oncomplete = () => {
        try {
          resolve(request.result === undefined ? null : decode(request.result));
        } catch (error) {
          reject(error);
        }
      };
    });
  }

  async save(snapshot: Snapshot): Promise<void> {
    // Capture and validate before yielding, so the caller cannot mutate a
    // pending write and a damaged snapshot never replaces a valid one.
    const raw = JSON.stringify(snapshot);
    decode(raw);
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
      transaction.objectStore(STORE).put(raw, STORAGE_KEY);
    });
  }

  async restore(legacy: Pick<Storage, 'getItem'>): Promise<Snapshot | null> {
    const saved = await this.load();
    if (saved) return saved;
    const raw = legacy.getItem(STORAGE_KEY);
    if (raw === null) return null;
    const migrated = decode(raw);
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

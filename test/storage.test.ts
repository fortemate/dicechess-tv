import { test } from 'node:test';
import assert from 'node:assert/strict';
import { IDBFactory } from 'fake-indexeddb';
import { SaveStore } from '../src/storage.ts';
import { derive, type Snapshot } from '../src/model.ts';

const completed: Snapshot = {
  schema: 1,
  humanMove: 'b1c3',
  botMove: 'b8c6',
};

test('acknowledged moves survive closing and reopening the save connection', async () => {
  const factory = new IDBFactory();
  let saves = new SaveStore(factory);
  for (const snapshot of [
    { schema: 1 } as Snapshot,
    { schema: 1, humanMove: 'b1c3' } as Snapshot,
    completed,
  ]) {
    await saves.save(snapshot);
    await saves.close();
    saves = new SaveStore(factory);
    const restored = await saves.load();
    assert.deepEqual(restored, snapshot);
    assert.deepEqual(derive(restored!), derive(snapshot));
  }
  await saves.close();
});

test('request success followed by transaction abort must not acknowledge or replace the last save', async () => {
  const factory = new IDBFactory();
  const open = factory.open.bind(factory);
  let abortWrite = false;
  let requestSucceeded = false;
  factory.open = (...args) => {
    const request = open(...args);
    request.addEventListener('success', () => {
      const database = request.result;
      const transaction = database.transaction.bind(database);
      database.transaction = (...parameters) => {
        const tx = transaction(...parameters);
        if (parameters[1] === 'readwrite') {
          assert.equal(parameters[2]?.durability, 'strict');
          if (abortWrite) {
            const objectStore = tx.objectStore.bind(tx);
            tx.objectStore = (name) => {
              const store = objectStore(name);
              const put = store.put.bind(store);
              store.put = (...values) => {
                const result = put(...values);
                result.addEventListener('success', () => {
                  requestSucceeded = true;
                  tx.abort();
                });
                return result;
              };
              return store;
            };
          }
        }
        return tx;
      };
    });
    return request;
  };
  const saves = new SaveStore(factory);
  await saves.save({ schema: 1 });
  abortWrite = true;
  await assert.rejects(saves.save(completed), /abort/i);
  assert.equal(requestSucceeded, true);
  assert.deepEqual(await saves.load(), { schema: 1 });
  await saves.close();
});

test('legacy migration is validated and a committed reset wins over the old game', async () => {
  const saves = new SaveStore(new IDBFactory());
  const legacy = { getItem: () => JSON.stringify(completed) };
  assert.deepEqual(await saves.restore(legacy), completed);
  await saves.save({ schema: 1 });
  assert.deepEqual(await saves.restore(legacy), { schema: 1 });
  await saves.close();
});

test('invalid legacy data and invalid writes never create or replace a save', async () => {
  const saves = new SaveStore(new IDBFactory());
  await assert.rejects(saves.restore({ getItem: () => '{broken' }));
  assert.equal(await saves.load(), null);
  await saves.save(completed);
  await assert.rejects(saves.save({ schema: 1, humanMove: 'e2e4' }));
  assert.deepEqual(await saves.load(), completed);
  await saves.close();
});

test('unsupported strict durability fails without acknowledging a weaker save', async () => {
  const factory = new IDBFactory();
  const open = factory.open.bind(factory);
  factory.open = (...args) => {
    const request = open(...args);
    request.addEventListener('success', () => {
      const database = request.result;
      const transaction = database.transaction.bind(database);
      // Emulate a browser that ignores the options argument.
      database.transaction = (stores, mode) => transaction(stores, mode);
    });
    return request;
  };
  const saves = new SaveStore(factory);
  await assert.rejects(saves.save(completed), /Strict save transactions/);
  assert.equal(await saves.load(), null);
  await saves.close();
});

test('a caller cannot change a pending snapshot after submitting it', async () => {
  const saves = new SaveStore(new IDBFactory());
  const snapshot = { ...completed };
  const pending = saves.save(snapshot);
  snapshot.humanMove = 'b1a3';
  await pending;
  assert.deepEqual(await saves.load(), completed);
  await saves.close();
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runBotTask } from '../src/shims/botTask.ts';

test('the browser launch remains pending until its worker terminates, including a late result', async (t) => {
  const workers: FakeWorker[] = [];
  class FakeWorker {
    onmessage: ((event: { data: string }) => void) | null = null;
    onerror: (() => void) | null = null;
    terminated = false;
    constructor() {
      workers.push(this);
    }
    postMessage(raw: string) {
      assert.equal(raw, 'request');
    }
    terminate() {
      this.terminated = true;
    }
  }
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'Worker');
  Object.defineProperty(globalThis, 'Worker', {
    configurable: true,
    value: FakeWorker,
  });
  t.after(() => {
    if (previous) Object.defineProperty(globalThis, 'Worker', previous);
    else Reflect.deleteProperty(globalThis, 'Worker');
  });
  let settled = false;
  const pending = runBotTask('request', (result) => {
    assert.ok(
      workers[0].terminated,
      'stop the worker before allowing a successor',
    );
    assert.equal(result, 'late result');
  }).then(() => {
    settled = true;
  });
  const worker = workers[0];
  await Promise.resolve();
  assert.equal(settled, false, 'posting a message is not job completion');
  assert.equal(worker.terminated, false);
  worker.onmessage!({ data: 'late result' });
  await pending;
  assert.equal(settled, true);
  assert.equal(worker.onmessage, null);
});

test('browser worker, postMessage and publication failures terminate and reject', async () => {
  for (const failure of ['worker', 'post', 'publish']) {
    const workers: FakeWorker[] = [];
    class FakeWorker {
      onmessage: ((event: { data: string }) => void) | null = null;
      onerror: (() => void) | null = null;
      terminated = false;
      constructor() {
        workers.push(this);
      }
      postMessage() {
        if (failure === 'post') throw new Error('post failed');
      }
      terminate() {
        this.terminated = true;
      }
    }
    const previous = Object.getOwnPropertyDescriptor(globalThis, 'Worker');
    Object.defineProperty(globalThis, 'Worker', {
      configurable: true,
      value: FakeWorker,
    });
    const restore = () => {
      if (previous) Object.defineProperty(globalThis, 'Worker', previous);
      else Reflect.deleteProperty(globalThis, 'Worker');
    };
    try {
      const pending = assert.rejects(
        runBotTask('request', () => {
          throw new Error('publish failed');
        }),
        /failed/,
      );
      const worker = workers[0];
      if (failure === 'worker') worker.onerror!();
      else if (failure === 'publish') worker.onmessage!({ data: 'result' });
      await pending;
      assert.ok(worker.terminated);
      assert.equal(worker.onmessage, null);
      assert.equal(worker.onerror, null);
    } finally {
      restore();
    }
  }
});

/** Keep the transport pending until the browser worker has stopped. */
export function runBotTask(
  raw: string,
  publish: (response: string) => void,
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const worker = new Worker(new URL('./botTaskWorker.ts', import.meta.url), {
      type: 'module',
    });
    const stop = () => {
      worker.onmessage = null;
      worker.onerror = null;
      worker.terminate();
    };
    worker.onmessage = (event: MessageEvent<string>) => {
      stop();
      try {
        publish(event.data);
        resolve();
      } catch (error) {
        reject(error);
      }
    };
    worker.onerror = () => {
      stop();
      reject(new Error('Opponent worker failed'));
    };
    try {
      worker.postMessage(raw);
    } catch (error) {
      stop();
      reject(error);
    }
  });
}

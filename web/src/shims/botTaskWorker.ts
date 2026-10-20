// The browser-only counterpart of Vega's task.js; no React or native imports.
import { runBotJob } from '../../../native/src/botJob';

globalThis.onmessage = (event: MessageEvent<string>) => {
  globalThis.postMessage(JSON.stringify(runBotJob(event.data)));
};

// react-native, as the screens in native/src/ see it in the browser:
// react-native-web, with one change. The window is the television's, not the
// browser's. Vega reports a 960 x 540 dp screen, and every layout in native/src/
// is worked out from that; the bench draws it on a stage of that size and
// scales the stage to the browser window (see ../stage.ts).
export * from 'react-native-web';
import { MMKV } from './mmkv';
import { BOT_REQUEST, BOT_RESPONSE } from '../../../native/src/botJob';

// The browser bench has no Vega components. Its equivalent is a Web Worker
// running the same pure request handler, so the bench keeps playing bot games.
export const Linking = {
  async openURL(url: string) {
    if (!/^pkg:\/\/.+\.search$/.test(url))
      throw new Error('Unsupported bench component');
    const store = new MMKV();
    const raw = store.getString(BOT_REQUEST);
    if (!raw) throw new Error('Missing opponent request');
    const worker = new Worker(new URL('./botTaskWorker.ts', import.meta.url), {
      type: 'module',
    });
    worker.onmessage = (event: MessageEvent<string>) => {
      if (store.getString(BOT_REQUEST) === raw)
        store.set(BOT_RESPONSE, event.data);
      worker.terminate();
    };
    worker.onerror = () => {
      if (store.getString(BOT_REQUEST) === raw)
        store.set(
          BOT_RESPONSE,
          JSON.stringify({
            requestId: (JSON.parse(raw) as { requestId: string }).requestId,
            error: 'Opponent worker failed',
          }),
        );
      worker.terminate();
    };
    worker.postMessage(raw);
  },
};

export const TV_WIDTH = 960;
export const TV_HEIGHT = 540;

const TV = { width: TV_WIDTH, height: TV_HEIGHT, scale: 2, fontScale: 1 };

export const useWindowDimensions = () => TV;

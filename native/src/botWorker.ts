import {
  createWorkletRuntime,
  runOnRuntime,
  scheduleOnRN,
  type WorkletRuntime,
} from '@amazon-devices/react-native-worklets';
import { MMKV } from '@amazon-devices/react-native-mmkv';
import { afterDelay, type Activity } from './activity';
import { createBotClient, type BotWorker } from './botClient';
import { BOT_REQUEST, BOT_RESPONSE } from './botJob';

const ENGINE_ASSET = 'file:///pkg/assets/raw/bot-engine.js';
let sequence = 0;

// Worklets serialize this small bridge. The canonical engine is bundled once
// as an app asset and evaluated inside the background runtime, so its classes
// and closures never have to be copied from the interactive runtime.
function compute(source: string, raw: string, done: (message: string) => void) {
  'worklet';
  let response: string;
  try {
    const context = globalThis as typeof globalThis & {
      DiceChessWorkletEngine?: { runBotJob: (request: string) => unknown };
    };
    // Only the signed package's generated asset enters here, never remote or
    // user-provided JavaScript. Each runtime initializes its own engine once.
    if (!context.DiceChessWorkletEngine) (0, eval)(source);
    if (!context.DiceChessWorkletEngine)
      throw new Error('Opponent engine did not load');
    response = JSON.stringify(context.DiceChessWorkletEngine.runBotJob(raw));
  } catch (error) {
    response = JSON.stringify({
      requestId: (JSON.parse(raw) as { requestId: string }).requestId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
  scheduleOnRN(done, response);
}

export function createBotWorker(activity: Activity): BotWorker {
  const store = new MMKV();
  let runtime: WorkletRuntime | undefined;
  let source: Promise<string> | undefined;
  let disposed = false;
  const client = createBotClient({
    store,
    activity,
    schedule: afterDelay,
    now: Date.now,
    newId: () => `${Date.now().toString(36)}-${++sequence}`,
    launch: async () => {
      const raw = store.getString(BOT_REQUEST);
      if (!raw) throw new Error('Missing opponent request');
      source ??= fetch(ENGINE_ASSET).then(async (response) => {
        if (!response.ok)
          throw new Error('Opponent engine asset is unavailable');
        return response.text();
      });
      const code = await source;
      if (disposed || store.getString(BOT_REQUEST) !== raw) return;
      runtime ??= createWorkletRuntime({ name: 'DiceChessBot' });
      return new Promise<void>((resolve, reject) => {
        const complete = (message: string) => {
          try {
            if (!disposed && store.getString(BOT_REQUEST) === raw)
              store.set(BOT_RESPONSE, message);
            resolve();
          } catch (error) {
            reject(error);
          }
        };
        runOnRuntime(runtime!, compute)(code, raw, complete);
      });
    },
  });
  return {
    request: client.request,
    dispose() {
      disposed = true;
      client.dispose();
      runtime = undefined;
      source = undefined;
    },
  };
}

import { Asset } from 'expo-asset';
import { File } from 'expo-file-system';
import {
  createWorkletRuntime,
  scheduleOnRuntime,
  scheduleOnRN,
} from 'react-native-worklets';
import { afterDelay, type Activity } from '../../native/src/activity';
import { createBotClient, type BotWorker } from '../../native/src/botClient';
import { BOT_REQUEST, BOT_RESPONSE } from '../../native/src/botJob';
import { createStore } from './store';

let sequence = 0;
let source: Promise<string> | undefined;
function loadEngine() {
  source ??= (async () => {
    const asset = Asset.fromModule(require('../assets/bot.engine'));
    await asset.downloadAsync();
    if (!asset.localUri) throw new Error('Packaged engine has no local URI');
    return new File(asset.localUri).text();
  })().catch((error) => {
    source = undefined;
    throw error;
  });
  return source;
}

function compute(
  code: string,
  raw: string,
  diagnosticHoldMs: number,
  done: (message: string) => void,
) {
  'worklet';
  let response: string;
  try {
    const context = globalThis as typeof globalThis & {
      DiceChessWorkletEngine?: { runBotJob: (request: string) => unknown };
    };
    // Only our build-generated, bundled asset is evaluated. Never network/user code.
    if (!context.DiceChessWorkletEngine) (0, eval)(code);
    if (!context.DiceChessWorkletEngine) throw new Error('Engine did not load');
    // Diagnostic CPU hold only, before the real search. Never a bot work budget.
    const until = Date.now() + diagnosticHoldMs;
    while (Date.now() < until) {
      /* Keep only the background runtime busy. */
    }
    response = JSON.stringify(context.DiceChessWorkletEngine.runBotJob(raw));
  } catch (error) {
    response = JSON.stringify({
      requestId: (JSON.parse(raw) as { requestId: string }).requestId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
  scheduleOnRN(done, response);
}

export function createWorker(
  activity: Activity,
  diagnosticHoldMs = 0,
): BotWorker {
  // Independent mailboxes also isolate a disposed worker's late callback.
  const workerId = ++sequence;
  const store = createStore(`android-probe-worker-${workerId}`);
  let runtime: ReturnType<typeof createWorkletRuntime> | undefined;
  let disposed = false;
  const client = createBotClient({
    store,
    activity,
    schedule: afterDelay,
    now: Date.now,
    newId: () => `${workerId}-${++sequence}`,
    launch: async () => {
      const raw = store.getString(BOT_REQUEST);
      if (!raw) throw new Error('Missing opponent request');
      const code = await loadEngine();
      if (disposed || store.getString(BOT_REQUEST) !== raw) return;
      runtime ??= createWorkletRuntime({ name: `AndroidProbeBot-${workerId}` });
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
        scheduleOnRuntime(
          runtime!,
          compute,
          code,
          raw,
          diagnosticHoldMs,
          complete,
        );
      });
    },
  });
  return {
    request: client.request,
    dispose() {
      disposed = true;
      client.dispose();
      runtime = undefined;
    },
  };
}

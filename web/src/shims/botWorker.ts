// The browser-only transport for the app's same serialized request protocol.
import { MMKV } from './mmkv';
import { runBotTask } from './botTask';
import { BOT_REQUEST, BOT_RESPONSE } from '../../../native/src/botJob';
import { afterDelay, type Activity } from '../../../native/src/activity';
import { createBotClient } from '../../../native/src/botClient';

let sequence = 0;
export function createBotWorker(activity: Activity) {
  const store = new MMKV();
  return createBotClient({
    store,
    activity,
    schedule: afterDelay,
    now: Date.now,
    newId: () => `${Date.now().toString(36)}-${++sequence}`,
    launch: () => {
      const raw = store.getString(BOT_REQUEST);
      if (!raw) throw new Error('Missing opponent request');
      return runBotTask(raw, (response) => {
        if (store.getString(BOT_REQUEST) === raw)
          store.set(BOT_RESPONSE, response);
      });
    },
  });
}

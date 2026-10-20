// The browser-only transport for the app's same serialized request protocol.
import { Linking } from './react-native';
import { MMKV } from './mmkv';
import { afterDelay, type Activity } from '../../../native/src/activity';
import { createBotClient } from '../../../native/src/botClient';

let sequence = 0;
export function createBotWorker(activity: Activity) {
  return createBotClient({
    store: new MMKV(),
    activity,
    schedule: afterDelay,
    now: Date.now,
    newId: () => `${Date.now().toString(36)}-${++sequence}`,
    launch: () => Linking.openURL('pkg://dicechess-tv.bench.search'),
  });
}

import { Linking } from 'react-native';
import { MMKV } from '@amazon-devices/react-native-mmkv';
import appConfig from '../app.json';
import { afterDelay, type Activity } from './activity';
import { createBotClient } from './botClient';

let sequence = 0;
export function createBotWorker(activity: Activity) {
  return createBotClient({
    store: new MMKV(),
    activity,
    launch: () =>
      Linking.openURL('pkg://' + appConfig.name.replace(/\.main$/, '.search')),
    schedule: afterDelay,
    now: Date.now,
    newId: () => `${Date.now().toString(36)}-${++sequence}`,
  });
}

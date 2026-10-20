import { MMKV } from '@amazon-devices/react-native-mmkv';
import { BOT_REQUEST, BOT_RESPONSE, runBotJob } from './botJob';

export async function runBotTask(): Promise<void> {
  // Use the default MMKV configuration, as in App. Custom IDs and modes are
  // not supported consistently by the Vega MMKV implementation.
  const store = new MMKV();
  try {
    const raw = store.getString(BOT_REQUEST);
    if (!raw) return;
    const result = runBotJob(raw);
    // A cold start or an abandoned game must not receive an older job's reply.
    if (store.getString(BOT_REQUEST) === raw)
      store.set(BOT_RESPONSE, JSON.stringify(result));
  } catch {
    // A malformed mailbox or storage failure must not crash the shared native
    // process. The requesting UI reports a missing response without searching.
  }
}

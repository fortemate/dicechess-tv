import type { KeyValueStore } from '../../native/src/keyValueStore';
import type { Recovery } from '../../native/src/Recovery';
import { GAME_KEY } from './gameSession';

export const LEGACY_SKIPPED_KEY = 'legacy-skipped.v1';

/** Only an explicit fresh choice clears the current slot; retain settings and legacy saves. */
export function recoverCurrentGame(store: KeyValueStore, choice: Recovery) {
  if (choice !== 'fresh') return;
  // Mark the decision first: a failed marker write must never delete a game.
  // Retained legacy saves must not reappear as an automatic migration afterward.
  store.set(LEGACY_SKIPPED_KEY, 'yes');
  store.delete(GAME_KEY);
}

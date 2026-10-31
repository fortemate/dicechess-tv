import type { BoardKey } from '../../src/core/boardInput';
import type { KeyValueStore } from '../../native/src/keyValueStore';
import {
  initialState,
  screenReducer,
  type ScreenOptions,
} from '../../native/src/screen';
import {
  readTutorialOffered,
  saveTutorialOffered,
} from '../../native/src/tutorialOfferSetting';
import { GAME_KEY, GAME_STORE, legacyGameStoreId } from './gameSession';
import { LEGACY_SKIPPED_KEY } from './recovery';

/** Read only presence: even an unreadable save identifies a returning player. */
export function shouldOfferTutorial(
  settings: KeyValueStore,
  openStore: (id: string) => KeyValueStore,
): boolean {
  if (readTutorialOffered(settings)) return false;
  const current = openStore(GAME_STORE);
  if (
    current.getString(GAME_KEY) !== undefined ||
    current.getString(LEGACY_SKIPPED_KEY) === 'yes'
  )
    return false;
  return (['hotseat', 'bot'] as const).every(
    (mode) =>
      openStore(legacyGameStoreId(mode)).getString(GAME_KEY) === undefined,
  );
}

export type TutorialAnswer = 'learn' | 'skip';

// The offer only navigates overlays. No roll, search, schedule or game save runs.
const options: ScreenOptions = {
  newId: () => 'tutorial-offer',
  roll: () => {
    throw new Error('The tutorial offer cannot roll dice');
  },
  side: () => 'w',
  schedule: () => {
    throw new Error('The tutorial offer cannot schedule gameplay');
  },
};

/** Use Vega's reducer and persist the answer before publishing a route change. */
export function createTutorialOffer(settings: KeyValueStore) {
  let state = initialState(options, null, {}, true);
  return {
    read: () => state,
    press(key: BoardKey, repeat = false): TutorialAnswer | null {
      if (state.overlay.kind !== 'offer') return null;
      const next = screenReducer(state, { kind: 'key', key, repeat }, options);
      let answer: TutorialAnswer | null = null;
      if (next.overlay.kind !== 'offer') {
        saveTutorialOffered(settings);
        answer = next.overlay.kind === 'tutorial' ? 'learn' : 'skip';
      }
      state = next;
      return answer;
    },
  };
}

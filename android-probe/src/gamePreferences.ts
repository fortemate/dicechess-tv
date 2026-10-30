import type { KeyValueStore } from '../../native/src/keyValueStore';
import type { BoardKey } from '../../src/core/boardInput';
import {
  readHighlights,
  saveHighlights,
} from '../../native/src/highlightsSetting';
import {
  readAutoSelect,
  saveAutoSelect,
} from '../../native/src/autoSelectSetting';
import { readTurnBoard, saveTurnBoard } from '../../native/src/turnSetting';
import {
  changeGameplaySetting,
  type GameplaySettingId,
} from '../../native/src/screen';

/** Read canonical gameplay preferences, retaining Vega defaults for absent or invalid stored values. */
export function readGamePreferences(store: KeyValueStore) {
  return {
    highlights: readHighlights(store),
    autoSelect: readAutoSelect(store),
    turnHotseat: readTurnBoard(store),
  };
}
/** Keep preferences separate from the game and publish each choice only after its synchronous write succeeds. */
export function createGamePreferences(store: KeyValueStore) {
  let value = readGamePreferences(store);
  return {
    read: () => value,
    /** Apply shared control semantics; a failed write leaves the in-memory choice unchanged. */
    press(row: GameplaySettingId, key: BoardKey) {
      const next = changeGameplaySetting(value, row, key);
      if (next.highlights !== value.highlights)
        saveHighlights(store, next.highlights);
      if (next.autoSelect !== value.autoSelect)
        saveAutoSelect(store, next.autoSelect);
      if (next.turnHotseat !== value.turnHotseat)
        saveTurnBoard(store, next.turnHotseat);
      value = next;
      return value;
    },
  };
}

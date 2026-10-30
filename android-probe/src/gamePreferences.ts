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

export function readGamePreferences(store: KeyValueStore) {
  return {
    highlights: readHighlights(store),
    autoSelect: readAutoSelect(store),
    turnHotseat: readTurnBoard(store),
  };
}
export function createGamePreferences(store: KeyValueStore) {
  let value = readGamePreferences(store);
  return {
    read: () => value,
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

import { decodeGame, newGame, type Game } from '../../src/core/game';
import { encodeSnapshot } from '../../src/core/snapshotStore';
import {
  homeItems,
  initialState,
  menuItems,
  screenReducer,
  type ScreenOptions,
  type GameplaySettings,
  type ScreenState,
  type ScreenAction,
  type GameChoice,
} from '../../native/src/screen';
import type { KeyValueStore } from '../../native/src/keyValueStore';

export type ProbeMode = 'hotseat' | 'bot';
export type GameIntent =
  'continue' | 'new' | { kind: 'tutorial'; choice: GameChoice };
export const GAME_KEY = 'game.v1';
export const GAME_STORE = 'dicechess-android-game';
export const legacyGameStoreId = (mode: ProbeMode) =>
  mode === 'hotseat' ? 'dicechess-android-hotseat' : 'dicechess-android-bot';

export function readSavedGame(store: KeyValueStore) {
  const raw = store.getString(GAME_KEY);
  return raw === undefined ? null : decodeGame(raw);
}
export type GameAction = Extract<
  ScreenAction,
  { kind: 'key' | 'unguard' | 'bot' | 'auto' }
>;

// Retain Vega's IDs, labels, order and reducer indices. Only implemented
// screens are reachable in this prototype.
export const gameMenu = (game: Game) =>
  menuItems(game)
    .map((item, index) => ({ ...item, index }))
    .filter(({ id }) => id !== 'settings');

export function gameStep(
  state: ScreenState,
  action: GameAction,
  options: ScreenOptions,
): ScreenState {
  const { overlay } = state;
  if (
    action.kind === 'key' &&
    overlay.kind === 'menu' &&
    ['up', 'down', 'left', 'right'].includes(action.key)
  ) {
    const items = gameMenu(state.game);
    const index = items.findIndex((item) => item.index === overlay.index);
    const step = action.key === 'up' || action.key === 'left' ? -1 : 1;
    return {
      ...state,
      overlay: {
        kind: 'menu',
        index: items[(index + step + items.length) % items.length].index,
      },
    };
  }
  return screenReducer(state, action, options);
}

// Persist before publishing. New games enter the same home action as Vega,
// so cross-mode replacement, cancellation and result/rematch share its reducer.
export function createGameSession(
  store: KeyValueStore,
  options: ScreenOptions,
  mode: ProbeMode = 'hotseat',
  intent: GameIntent = 'continue',
  settings: Partial<GameplaySettings> = {},
) {
  const restored = readSavedGame(store);
  let saved = Boolean(restored);
  let current = initialState(
    options,
    restored ?? newGame('hotseat', options.newId()),
    { playAs: 'ask', ...settings },
  );
  current = {
    ...current,
    resumable: Boolean(restored && restored.phase !== 'ended'),
    overlay:
      restored?.phase === 'ended' && restored.mode !== 'hotseat'
        ? { kind: 'result', index: 0 }
        : { kind: 'none' },
  };
  if (typeof intent === 'object') {
    // The tutorial's closing choices use Vega's explicit new-game action:
    // Play Rolly starts as White, and a resumable game still asks first.
    current = screenReducer(
      current,
      { kind: 'newGame', ...intent.choice },
      options,
    );
  } else if (intent === 'new' || !restored) {
    const index = homeItems(current.resumable).findIndex(
      ({ id }) => id === (mode === 'bot' ? 'computer' : 'hotseat'),
    );
    current = screenReducer(
      { ...current, overlay: { kind: 'home', index } },
      { kind: 'key', key: 'select' },
      options,
    );
  }
  const save = (game: Game) => {
    store.set(GAME_KEY, encodeSnapshot(game, decodeGame));
    saved = true;
  };
  if (current.game !== restored && current.overlay.kind === 'none')
    save(current.game);
  return {
    getState: () => current,
    hasSave: () => saved,
    dispatch(action: GameAction) {
      const next = gameStep(current, action, options);
      if (next.game !== current.game) save(next.game);
      current = next;
      return current;
    },
  };
}

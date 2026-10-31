import { decodeGame, newGame, type Game } from '../../src/core/game';
import { encodeSnapshot } from '../../src/core/snapshotStore';
import {
  homeItems,
  initialState,
  menuItems,
  screenReducer,
  type ScreenOptions,
  type GameplaySettings,
  type ScreenSettings,
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

// Retain Vega's complete menu and reducer indices, including in-game Settings.
export const gameMenu = (game: Game) =>
  menuItems(game).map((item, index) => ({ ...item, index }));

/** Delegate menu navigation, gameplay and guarded automatic actions to Vega. */
export function gameStep(
  state: ScreenState,
  action: GameAction,
  options: ScreenOptions,
): ScreenState {
  return screenReducer(state, action, options);
}

// Persist before publishing. New games enter the same home action as Vega,
// so cross-mode replacement, cancellation and result/rematch share its reducer.
/** Restore a game with current preferences and synchronously persist changed snapshots before publishing state. */
export function createGameSession(
  store: KeyValueStore,
  options: ScreenOptions,
  mode: ProbeMode = 'hotseat',
  intent: GameIntent = 'continue',
  settings: Partial<GameplaySettings> = {},
  preferences?: {
    read(): ScreenSettings;
    save(next: ScreenSettings, before: ScreenSettings): void;
  },
) {
  const restored = readSavedGame(store);
  let saved = Boolean(restored);
  let current = initialState(
    options,
    restored ?? newGame('hotseat', options.newId()),
    settings,
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
    /** Persist changed preferences or gameplay before publishing the reducer result. */
    dispatch(action: GameAction) {
      let next = gameStep(current, action, options);
      if (next.overlay.kind === 'settings') {
        if (current.overlay.kind !== 'settings' && preferences)
          next = { ...next, ...preferences.read() };
        else preferences?.save(next, current);
      }
      if (next.game !== current.game) save(next.game);
      current = next;
      return current;
    },
  };
}

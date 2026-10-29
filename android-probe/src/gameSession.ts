import { decodeGame, isBotMode, newGame, type Game } from '../../src/core/game';
import { encodeSnapshot } from '../../src/core/snapshotStore';
import {
  initialState,
  menuItems,
  screenReducer,
  type ScreenOptions,
  type ScreenState,
  type ScreenAction,
} from '../../native/src/screen';
import type { KeyValueStore } from '../../native/src/keyValueStore';

export type ProbeMode = 'hotseat' | 'bot';
export const GAME_KEY = 'game.v1';
export type GameAction = Extract<
  ScreenAction,
  { kind: 'key' | 'unguard' | 'bot' }
>;

// Keep the shared menu indices and confirmation logic. The prototype exposes
// only the implemented game flows, with its diagnostics as the exit target.
export const gameMenu = (game: Game) =>
  menuItems(game)
    .map((item, index) => ({ ...item, index }))
    .filter(({ id }) =>
      game.phase === 'ended'
        ? id === 'new-game' || id === 'main-menu'
        : !['rules', 'settings'].includes(id),
    )
    .map((item) => ({
      ...item,
      label: item.id === 'main-menu' ? 'Diagnostics' : item.label,
    }));

export function gameStep(
  state: ScreenState,
  action: GameAction,
  options: ScreenOptions,
): ScreenState {
  const { overlay } = state;
  if (action.kind === 'key') {
    const { key } = action;
    const items = gameMenu(state.game);
    if (
      overlay.kind === 'menu' &&
      ['up', 'down', 'left', 'right'].includes(key)
    ) {
      const index = items.findIndex((item) => item.index === overlay.index);
      const step = key === 'up' || key === 'left' ? -1 : 1;
      return {
        ...state,
        overlay: {
          kind: 'menu',
          index: items[(index + step + items.length) % items.length].index,
        },
      };
    }
    if (
      overlay.kind === 'none' &&
      state.game.phase === 'ended' &&
      ['select', 'back', 'menu'].includes(key)
    )
      return { ...state, overlay: { kind: 'menu', index: items[0].index } };
  }
  let next = screenReducer(state, action, options);
  // Show a result on the board; this slice uses its limited menu for a rematch.
  if (next.overlay.kind === 'result')
    next = { ...next, overlay: { kind: 'none' } };
  // Shared confirmation cancellation returns to menu row 0. After a result
  // this slice only exposes New game and Diagnostics, so restore visible focus.
  if (next.overlay.kind === 'menu') {
    const index = next.overlay.index;
    const available = gameMenu(next.game);
    if (!available.some((item) => item.index === index))
      return { ...next, overlay: { kind: 'menu', index: available[0].index } };
  }
  return next;
}

// Persist synchronously before publishing a game transition. A failed write
// leaves both the session and its visible game at the last committed state.
// Invalid saved data is never silently replaced with a fresh game.
export function createGameSession(
  store: KeyValueStore,
  options: ScreenOptions,
  mode: ProbeMode = 'hotseat',
) {
  const raw = store.getString(GAME_KEY);
  const decode = (value: string) => {
    const game = decodeGame(value);
    if (mode === 'hotseat' ? game.mode !== 'hotseat' : !isBotMode(game.mode))
      throw new Error('This save belongs to a different game mode');
    return game;
  };
  const restored = raw === undefined ? null : decode(raw);
  const choosing = mode === 'bot' && !restored;
  let saved = Boolean(restored);
  let current: ScreenState = {
    ...initialState(
      options,
      restored ??
        newGame(mode === 'bot' ? 'random' : 'hotseat', options.newId()),
      { playAs: 'ask' },
    ),
    overlay: choosing
      ? { kind: 'opponent', index: 0, from: 'home' }
      : { kind: 'none' },
    resumable: !choosing,
  };
  const save = (game: Game) => {
    store.set(GAME_KEY, encodeSnapshot(game, decode));
    saved = true;
  };
  // A first bot selection is only a preview until opponent and side are chosen.
  if (!restored && !choosing) save(current.game);
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

import {
  decodeGame,
  isBotMode,
  sideName,
  type Game,
} from '../../src/core/game';
import { opponentOf } from '../../src/core/opponents';
import {
  homeItems as sharedHomeItems,
  HOTSEAT_OPTION,
  COMPUTER_OPTION,
} from '../../native/src/screen';
import type { KeyValueStore } from '../../native/src/keyValueStore';
import { GAME_KEY, type GameIntent, type ProbeMode } from './gameSession';

export type GameRoute = { kind: 'game'; mode: ProbeMode; intent: GameIntent };
export type HomeItem = {
  id: string;
  label: string;
  description: string;
  action: GameRoute | { kind: 'rules' };
};
export const gameMode = (game: Game): ProbeMode =>
  game.mode === 'hotseat' ? 'hotseat' : 'bot';
const summary = (game: Game) =>
  game.phase === 'ended'
    ? 'Completed game'
    : `Turn ${game.turn} · ${game.human ? `You: ${sideName(game.human)}` : 'Two players share the remote'}`;

// Vega owns the menu IDs, labels and order. Unsupported screens stay hidden.
export function homeItems(game: Game | null, unreadable = false): HomeItem[] {
  return sharedHomeItems(unreadable || Boolean(game && game.phase !== 'ended'))
    .filter(({ id }) => ['resume', 'hotseat', 'computer', 'rules'].includes(id))
    .map(({ id, label }): HomeItem => {
      if (id === 'rules')
        return {
          id,
          label,
          description: 'Read the rules and special moves.',
          action: { kind: 'rules' },
        };
      return {
        id,
        label,
        description:
          id === 'resume'
            ? unreadable
              ? 'The saved game could not be read. Open it for details.'
              : game
                ? summary(game)
                : ''
            : id === 'hotseat'
              ? 'Take turns with one remote.'
              : 'Choose Rolly, Grabby or Rampage and your side.',
        action: {
          kind: 'game',
          mode:
            id === 'resume' && game
              ? gameMode(game)
              : id === 'computer'
                ? 'bot'
                : 'hotseat',
          intent: id === 'resume' ? 'continue' : 'new',
        },
      };
    });
}

export type LegacyGame = {
  mode: ProbeMode;
  raw: string;
  label: string;
  description: string;
  game?: Game;
  error?: string;
};

// Migration copies validated bytes once. Never delete or rewrite either legacy
// slot, including damaged data or the game the user did not choose.
export function legacyGames(
  read: (mode: ProbeMode) => string | undefined,
): LegacyGame[] {
  return (['hotseat', 'bot'] as const).flatMap<LegacyGame>((mode) => {
    const raw = read(mode);
    if (raw === undefined) return [];
    const label = mode === 'hotseat' ? HOTSEAT_OPTION : COMPUTER_OPTION;
    try {
      const game = decodeGame(raw);
      if (mode === 'hotseat' ? game.mode !== 'hotseat' : !isBotMode(game.mode))
        throw new Error('This save belongs to a different game mode');
      return [
        {
          mode,
          raw,
          game,
          label: isBotMode(game.mode)
            ? `${label} · ${opponentOf(game.mode).name}`
            : label,
          description: summary(game),
        },
      ];
    } catch (error) {
      return [
        {
          mode,
          raw,
          label,
          description: 'This saved game could not be read.',
          error: String(error),
        },
      ];
    }
  });
}

export function migrateGame(store: KeyValueStore, legacy: LegacyGame) {
  // A completed previous attempt takes precedence, including after a restart.
  const existing = store.getString(GAME_KEY);
  if (existing !== undefined) return decodeGame(existing);
  if (!legacy.game)
    throw new Error(legacy.error ?? 'The old save could not be read');
  store.set(GAME_KEY, legacy.raw);
  return legacy.game;
}

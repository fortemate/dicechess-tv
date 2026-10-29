import { sideName, type Game } from '../../src/core/game';
import { opponentOf } from '../../src/core/opponents';
import type { GameIntent, ProbeMode } from './gameSession';

export type HomeItem = {
  id: string;
  label: string;
  description: string;
  action:
    | { kind: 'diagnostics' }
    | { kind: 'game'; mode: ProbeMode; intent: GameIntent };
};

// Read each independent save without changing it. A damaged slot remains
// reachable through the existing error screen and never hides the other game.
export function homeItems(read: (mode: ProbeMode) => Game | null): HomeItem[] {
  const items: HomeItem[] = [];
  for (const mode of ['bot', 'hotseat'] as const) {
    const item = {
      id: `continue-${mode}`,
      action: { kind: 'game', mode, intent: 'continue' },
    } as const;
    try {
      const game = read(mode);
      if (!game) continue;
      const against =
        game.mode === 'hotseat'
          ? 'with a friend'
          : `vs ${opponentOf(game.mode).name}`;
      items.push({
        ...item,
        label: `${game.phase === 'ended' ? 'View result' : 'Continue'} ${against}`,
        description:
          game.phase === 'ended'
            ? 'Review the last game or start a rematch.'
            : `Turn ${game.turn} · ${game.human ? `You: ${sideName(game.human)}` : 'Two players share the remote'}`,
      });
    } catch {
      items.push({
        ...item,
        label: `Open saved ${mode === 'bot' ? 'computer' : 'two-player'} game`,
        description:
          'The save could not be read. Open it for details; saved data is kept.',
      });
    }
  }
  return [
    ...items,
    {
      id: 'new-bot',
      label: 'New game vs computer',
      description: 'Choose Rolly, Grabby or Rampage and your side.',
      action: { kind: 'game', mode: 'bot', intent: 'new' },
    },
    {
      id: 'new-hotseat',
      label: 'New game with a friend',
      description: 'Take turns with one remote. Each mode has its own save.',
      action: { kind: 'game', mode: 'hotseat', intent: 'new' },
    },
    {
      id: 'diagnostics',
      label: 'Diagnostics',
      description: 'Compatibility checks for this Android prototype.',
      action: { kind: 'diagnostics' },
    },
  ];
}

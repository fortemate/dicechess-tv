// The level of danger the music plays over a game (#76), measured at the start
// of every turn.
//
// The search in src/core/danger.ts is advanced one step at a time through the
// app's background scheduler, so it runs between frames and never holds the
// remote up: on the virtual device a whole search took up to 1.6 s. A new turn,
// or leaving the game, abandons a search still running.
import React from 'react';
import { finish, settle, turnDanger, type Level } from '../../src/core/danger';
import type { Game } from '../../src/core/game';
import type { ScreenOptions } from './screen';

export function useDanger(
  game: Game,
  background: ScreenOptions['background'],
  // Diagnostics: what each measurement found and what it cost.
  report?: (line: string) => void,
): Level {
  const [state, setState] = React.useState<{ id: string; level: Level }>({
    id: game.id,
    level: 'calm',
  });
  // Once per turn: the turn's starting position does not change while it is
  // played, so neither does the answer.
  const { id, start, human } = game;
  const live = game.phase !== 'ended';
  React.useEffect(() => {
    if (!live) return;
    let cancelled = false;
    const search = turnDanger({ start, human, phase: 'roll' });
    const began = Date.now();
    let steps = 0;
    // A new game starts from its own first answer, not from the last game's.
    const heard = (measured: Level) => {
      report?.(
        `danger ${measured} in ${steps} steps, ${Date.now() - began} ms`,
      );
      setState((current) => ({
        id,
        level: current.id === id ? settle(current.level, measured) : measured,
      }));
    };
    if (!background) {
      heard(finish(search));
      return;
    }
    const step = () => {
      if (cancelled) return;
      steps++;
      const measured = search.step();
      if (measured === null) background(step);
      else heard(measured);
    };
    background(step);
    return () => {
      cancelled = true;
    };
  }, [id, start, human, live, background, report]);
  return state.id === id ? state.level : 'calm';
}

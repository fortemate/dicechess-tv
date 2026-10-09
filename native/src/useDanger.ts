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
import { ActivityContext, activeClock, scheduleActive } from './activity';

export function useDanger(
  game: Game,
  background: ScreenOptions['background'],
  // Diagnostics: what each measurement found and what it cost.
  report?: (line: string) => void,
): Level {
  const activity = React.useContext(ActivityContext);
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
    let cancelStep: () => void = () => undefined;
    const search = turnDanger({ start, human, phase: 'roll' });
    const clock = activeClock(activity, Date.now);
    const began = clock.now();
    let steps = 0;
    // A new game starts from its own first answer, not from the last game's.
    const heard = (measured: Level) => {
      report?.(
        `danger ${measured} in ${steps} steps, ${clock.now() - began} ms`,
      );
      clock.dispose();
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
      if (measured === null)
        cancelStep = scheduleActive(activity, background, step);
      else heard(measured);
    };
    cancelStep = scheduleActive(activity, background, step);
    return () => {
      cancelled = true;
      cancelStep();
      clock.dispose();
    };
  }, [id, start, human, live, background, report, activity]);
  return state.id === id ? state.level : 'calm';
}

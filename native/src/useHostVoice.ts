// The Hot Seat host in the game screen (#202): picks Rolly's lines at the
// pauses of a hotseat game, holds each until it has been said, and queues a
// line behind the one being said, so a line never cuts another. A line that
// waits belongs to the pause it was picked at: once the game takes another
// step it is put back unheard, whatever its tier. events.json lets a bot's
// always-tier line outlast the next step; the host never speaks while someone
// is thinking, so hers does not.
//
// She is heard and seen (#213): what she says goes to `onVoiceLine`, and the
// hook returns the line being said, which the game screen shows with her
// portrait above the bottom badge for as long as it holds. The timing runs on
// refs; the returned line only mirrors the one being said.
//
// The host's state lasts the session: the game screen stays mounted from launch
// to exit, so her shuffled bags and whether she has taught the pass carry from
// one game to the next. She picks nothing while the board is not on screen
// (`live`): an unstarted game behind the home screen says nothing, and a line
// that waits is said when the board returns. Off (`on`), Hot Seat is as it was
// before her: she says nothing, and a line she is saying stops.
import React from 'react';
import type { Game } from '../../src/core/game';
import {
  INITIAL_HOST_STATE,
  hostVoiceCue,
  isResultLine,
  restoreLine,
  startsHosting,
  type HostEvent,
  type HostLine,
  type HostState,
} from '../../src/core/hostVoice';
import { DISMISS_DELAY_MS } from './useBotVoice';

export type UseHostVoiceOptions = {
  // The board is on screen with nothing over it.
  live: boolean;
  // A host is chosen in Settings, rather than off.
  on: boolean;
  // How long a line holds, when it should outlast `timeoutMs`: until it has
  // been said. The next line waits for it.
  holdMs?: (line: HostLine) => number;
  onVoiceLine?: (line: HostLine) => void;
  // Told when the host is turned off while a line of hers holds, so the line
  // she is saying stops.
  onStop?: () => void;
  timeoutMs?: number;
  // Injected so a test knows which line is picked.
  random?: () => number;
};

// A line picked, with the event it was picked for: a colour's win may be a line
// of the colourless 'win', and its bag is the colour's. And the step of the
// game it was picked at, the pause it belongs to.
type Picked = {
  readonly line: HostLine;
  readonly event: HostEvent;
  readonly gameId: string;
  readonly revision: number;
};

// The game is still at the step the line was picked at.
const pausing = (picked: Picked, game: Game): boolean =>
  picked.gameId === game.id && picked.revision === game.revision;

type Box<T> = { current: T };

const stopTimer = (timer: Box<ReturnType<typeof setTimeout> | null>) => {
  if (timer.current) clearTimeout(timer.current);
  timer.current = null;
};

// A line picked but never said goes back to the front of its bag.
const restorePending = (state: Box<HostState>, pending: Box<Picked | null>) => {
  const waiting = pending.current;
  pending.current = null;
  if (waiting)
    state.current = restoreLine(state.current, waiting.event, waiting.line.id);
};

export function useHostVoice(
  game: Game,
  options: UseHostVoiceOptions,
): HostLine | null {
  const state = React.useRef<HostState>(INITIAL_HOST_STATE);
  // The last game seen while the board was on screen and the host on.
  const lastGame = React.useRef<Game | null>(null);
  const speaking = React.useRef<Picked | null>(null);
  const pending = React.useRef<Picked | null>(null);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  // The line being said, for the screen to show.
  const [shown, setShown] = React.useState<HostLine | null>(null);

  const { live, on } = options;
  const liveRef = React.useRef(live);
  const onRef = React.useRef(on);
  const gameRef = React.useRef(game);
  const optionsRef = React.useRef(options);
  React.useLayoutEffect(() => {
    liveRef.current = live;
    onRef.current = on;
    gameRef.current = game;
    optionsRef.current = options;
  });

  const speak = React.useCallback((first: Picked) => {
    function begin(next: Picked): void {
      speaking.current = next;
      setShown(next.line);
      optionsRef.current.onVoiceLine?.(next.line);
      stopTimer(timer);
      // The last word holds while the result shows; a new game replaces it.
      if (isResultLine(next.line)) return;
      const hold = optionsRef.current.holdMs?.(next.line) ?? 0;
      timer.current = setTimeout(
        () => {
          timer.current = null;
          speaking.current = null;
          setShown(null);
          const waiting = pending.current;
          if (!waiting || !liveRef.current || !onRef.current) return;
          // The game moved on, and the effect below has not seen it yet.
          if (!pausing(waiting, gameRef.current)) {
            restorePending(state, pending);
            return;
          }
          pending.current = null;
          begin(waiting);
        },
        Math.max(optionsRef.current.timeoutMs ?? DISMISS_DELAY_MS, hold),
      );
    }
    begin(first);
  }, []);

  const clear = React.useCallback(() => {
    stopTimer(timer);
    speaking.current = null;
    setShown(null);
  }, []);

  // Not a Hot Seat game, or no host: a line that waits goes back, and one being
  // said ends.
  const standDown = React.useCallback(
    (turnedOff: boolean) => {
      restorePending(state, pending);
      if (!speaking.current) return;
      clear();
      // Turned off mid-line, she stops talking. A new game against the bot has
      // a line of its own, which this leaves alone.
      if (turnedOff) optionsRef.current.onStop?.();
    },
    [clear],
  );

  // A line that waits is said, unless another is being said.
  const sayWaiting = React.useCallback(() => {
    const waiting = pending.current;
    if (speaking.current || !waiting) return;
    pending.current = null;
    speak(waiting);
  }, [speak]);

  React.useEffect(() => {
    if (game.mode !== 'hotseat' || !on) {
      standDown(!on);
      lastGame.current = null;
      return;
    }
    // Behind the home screen or a menu: nothing is picked or recorded, and a
    // line that waits goes on waiting. A line being said is left to finish, as
    // a bot's is: OK on a finished game goes to the home screen, and her last
    // word may still be waiting for its jingle.
    if (!live) return;

    const prev = lastGame.current;
    lastGame.current = game;
    // Only the board coming back, or the host turned on: a line that waited
    // for it is said.
    if (prev === game) {
      sayWaiting();
      return;
    }

    // The game she saw last, unless this one is new to her.
    const before = startsHosting(prev, game) ? null : prev;
    if (!before) {
      // A new game replaces whatever was said or waiting.
      restorePending(state, pending);
      if (speaking.current) clear();
    } else if (game.revision !== before.revision) {
      // The game moved on, past the pause a waiting line was picked at: it is
      // put back unheard, whatever its tier. A pass of the remote is then
      // taught at a later White turn end.
      restorePending(state, pending);
    }

    const cue = hostVoiceCue(
      before,
      game,
      state.current,
      optionsRef.current.random,
    );
    state.current = cue.state;
    if (!cue.line || !cue.event) return;
    const next: Picked = {
      line: cue.line,
      event: cue.event,
      gameId: game.id,
      revision: game.revision,
    };
    if (!speaking.current) {
      speak(next);
      return;
    }
    // It waits for the line being said. A step picks one line at most, and any
    // line waiting from an earlier step was put back above, so one waits at
    // most.
    pending.current = next;
  }, [game, live, on, speak, clear, standDown, sayWaiting]);

  React.useEffect(() => () => stopTimer(timer), []);
  return shown;
}

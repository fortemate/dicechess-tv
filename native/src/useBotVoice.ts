// Hook managing bot voice triggers and auto-dismiss timing in the gameplay HUD (#158).
import React from 'react';
import {
  botVoiceCue,
  INITIAL_BOT_VOICE_STATE,
  type BotVoiceState,
  type VoiceLine,
} from '../../src/core/botVoice';
import { isBotMode, type Game } from '../../src/core/game';
import { opponentOf } from '../../src/core/opponents';
import type { Level } from '../../src/core/danger';
import { ActivityContext, afterDelay, scheduleActive } from './activity';

export const DISMISS_DELAY_MS = 2800;

// The bot's last word, said as the game ends. It stays for as long as the
// result is on screen, where nothing else asks for the person's attention
// (#163); a new game replaces it with its own first line.
const lastWord = (line: VoiceLine): boolean =>
  line.event === 'win' || line.event === 'loss';

export type UseBotVoiceOptions = {
  timeoutMs?: number;
  // How long a line's bubble stays, when it should outlast `timeoutMs`: a
  // spoken line stays until it has been said (#159).
  holdMs?: (line: VoiceLine) => number;
  onVoiceLine?: (line: VoiceLine) => void;
  // The board is on screen, with nothing over it but a result (#202). While it
  // is not, nothing is said and no step is counted: a game restored at launch
  // says nothing behind the home screen, and a step taken behind an overlay is
  // judged when the board returns. On by default.
  live?: boolean;
};

export function useBotVoice(
  game: Game,
  dangerLevel: Level = 'calm',
  options?: UseBotVoiceOptions,
): VoiceLine | null {
  const activity = React.useContext(ActivityContext);
  const [activeLine, setActiveLine] = React.useState<VoiceLine | null>(null);
  const voiceState = React.useRef<BotVoiceState>(INITIAL_BOT_VOICE_STATE);
  const lastGame = React.useRef<Game | null>(null);
  const timer = React.useRef<(() => void) | null>(null);

  const timeoutMs = options?.timeoutMs ?? DISMISS_DELAY_MS;
  const live = options?.live ?? true;
  const timeoutMsRef = React.useRef(timeoutMs);
  const holdMsRef = React.useRef(options?.holdMs);
  const onVoiceLineRef = React.useRef(options?.onVoiceLine);

  React.useLayoutEffect(() => {
    timeoutMsRef.current = timeoutMs;
    holdMsRef.current = options?.holdMs;
    onVoiceLineRef.current = options?.onVoiceLine;
  });

  const showLine = React.useCallback(
    (line: VoiceLine) => {
      setActiveLine(line);
      onVoiceLineRef.current?.(line);
      timer.current?.();
      timer.current = null;
      if (lastWord(line)) return;
      const hold = holdMsRef.current?.(line) ?? 0;
      timer.current = scheduleActive(
        activity,
        afterDelay,
        () => {
          setActiveLine(null);
          timer.current = null;
        },
        Math.max(timeoutMsRef.current, hold),
      );
    },
    [activity],
  );

  React.useEffect(() => {
    if (!isBotMode(game.mode)) {
      if (timer.current) {
        timer.current();
        timer.current = null;
      }
      lastGame.current = game;
      return;
    }
    // Behind the home screen or a menu: nothing is evaluated, and the game is
    // not recorded, so the next step seen is judged from the last one seen.
    if (!live) return;

    const opponent = opponentOf(game.mode);
    const prev = lastGame.current;
    lastGame.current = game;

    // Reset voice state on new game or rematch
    // A new game speaks afresh, but remembers which lines were said last, so a
    // rematch does not open with the intro it just heard.
    if (prev?.id !== game.id) {
      voiceState.current = {
        ...INITIAL_BOT_VOICE_STATE,
        lastLines: voiceState.current.lastLines,
      };
      if (timer.current) {
        timer.current();
        timer.current = null;
      }
      const cue = botVoiceCue(
        game,
        game,
        opponent,
        dangerLevel,
        voiceState.current,
      );
      if (cue.line) {
        voiceState.current = cue.state;
        showLine(cue.line);
      } else {
        setActiveLine(null);
      }
      return;
    }

    // Evaluate step in ongoing game
    const cue = botVoiceCue(
      prev,
      game,
      opponent,
      dangerLevel,
      voiceState.current,
    );
    if (cue.line) {
      voiceState.current = cue.state;
      showLine(cue.line);
    }
  }, [game, dangerLevel, live, showLine]);

  React.useEffect(() => {
    return () => {
      if (timer.current) {
        timer.current();
        timer.current = null;
      }
    };
  }, []);

  return isBotMode(game.mode) ? activeLine : null;
}

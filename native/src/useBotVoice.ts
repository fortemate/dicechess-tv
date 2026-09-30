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

export const DISMISS_DELAY_MS = 2800;

export type UseBotVoiceOptions = {
  timeoutMs?: number;
  onVoiceLine?: (line: VoiceLine) => void;
};

export function useBotVoice(
  game: Game,
  dangerLevel: Level = 'calm',
  options?: UseBotVoiceOptions,
): VoiceLine | null {
  const [activeLine, setActiveLine] = React.useState<VoiceLine | null>(null);
  const voiceState = React.useRef<BotVoiceState>(INITIAL_BOT_VOICE_STATE);
  const lastGame = React.useRef<Game | null>(null);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const timeoutMs = options?.timeoutMs ?? DISMISS_DELAY_MS;
  const timeoutMsRef = React.useRef(timeoutMs);
  const onVoiceLineRef = React.useRef(options?.onVoiceLine);

  React.useLayoutEffect(() => {
    timeoutMsRef.current = timeoutMs;
    onVoiceLineRef.current = options?.onVoiceLine;
  });

  const showLine = React.useCallback((line: VoiceLine) => {
    setActiveLine(line);
    onVoiceLineRef.current?.(line);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setActiveLine(null);
      timer.current = null;
    }, timeoutMsRef.current);
  }, []);

  React.useEffect(() => {
    if (!isBotMode(game.mode)) {
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
      }
      lastGame.current = game;
      return;
    }

    const opponent = opponentOf(game.mode);
    const prev = lastGame.current;
    lastGame.current = game;

    // Reset voice state on new game or rematch
    if (!prev || prev.id !== game.id) {
      voiceState.current = INITIAL_BOT_VOICE_STATE;
      if (timer.current) {
        clearTimeout(timer.current);
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
  }, [game, dangerLevel, showLine]);

  React.useEffect(() => {
    return () => {
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
      }
    };
  }, []);

  return isBotMode(game.mode) ? activeLine : null;
}

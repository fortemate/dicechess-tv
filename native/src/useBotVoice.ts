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
  const holdMsRef = React.useRef(options?.holdMs);
  const onVoiceLineRef = React.useRef(options?.onVoiceLine);

  React.useLayoutEffect(() => {
    timeoutMsRef.current = timeoutMs;
    holdMsRef.current = options?.holdMs;
    onVoiceLineRef.current = options?.onVoiceLine;
  });

  const showLine = React.useCallback((line: VoiceLine) => {
    setActiveLine(line);
    onVoiceLineRef.current?.(line);
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (lastWord(line)) return;
    const hold = holdMsRef.current?.(line) ?? 0;
    timer.current = setTimeout(
      () => {
        setActiveLine(null);
        timer.current = null;
      },
      Math.max(timeoutMsRef.current, hold),
    );
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
    // A new game speaks afresh, but remembers which lines were said last, so a
    // rematch does not open with the intro it just heard.
    if (prev?.id !== game.id) {
      voiceState.current = {
        ...INITIAL_BOT_VOICE_STATE,
        lastLines: voiceState.current.lastLines,
      };
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

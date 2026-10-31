import React, { useEffect } from 'react';
import { View } from 'react-native';
import type { Game } from '../../src/core/game';
import { useBotVoice } from '../../native/src/useBotVoice';
import { useDanger } from '../../native/src/useDanger';
import type { SpokenLine } from '../../native/src/audio';
import type { TutorialVoice } from '../../native/src/useTutorialVoice';
import { speechTiming, LINE_START_MS } from '../../native/src/speechTiming';
import { useHostVoice } from '../../native/src/useHostVoice';
import { DEFAULT_HOST, type HostChoice } from '../../native/src/hostSetting';
import { HostBlock, HOST_HEIGHT } from '../../native/src/Matchup';
import {
  SpeechBubble,
  HOST_BUBBLE_ROWS,
  BUBBLE_ROWS,
  BUBBLE_LINE,
  BUBBLE_CHROME,
} from '../../native/src/SpeechBubble';

/** Reuse Vega's host/bot cues, caption timing and presentation with Android speech. */
export function HostCommentary({
  game,
  host,
  live,
  voice,
}: {
  game: Game;
  host: HostChoice;
  live: boolean;
  voice?: TutorialVoice;
}) {
  const level = useDanger(game, undefined, false);
  const holdMs = (line: SpokenLine) => {
    const timing = speechTiming(line);
    return timing ? timing.ms + timing.delayMs + LINE_START_MS : 0;
  };
  const botLine = useBotVoice(game, level, {
    live,
    holdMs,
    onVoiceLine: voice?.say,
  });
  const line = useHostVoice(game, {
    live,
    holdMs,
    onVoiceLine: voice?.say,
    onStop: voice?.stopLine,
    on: host !== 'off',
    host: host === 'off' ? DEFAULT_HOST : host,
  });
  const visible =
    live && game.mode === 'hotseat' && host !== 'off' && line !== null;
  useEffect(() => {
    console.info(
      '[AndroidHost] ' +
        JSON.stringify({
          event: 'state',
          detail: { host, visible, line: visible ? line : null },
        }),
    );
  }, [host, visible, line]);
  if (game.mode !== 'hotseat')
    return live ? (
      <View
        style={{
          height: BUBBLE_ROWS * BUBBLE_LINE + BUBBLE_CHROME,
          marginTop: 12,
        }}
      >
        {botLine ? <SpeechBubble text={botLine.text} /> : null}
      </View>
    ) : null;
  if (!live || host === 'off') return null;
  return (
    <View style={{ height: HOST_HEIGHT + 20, marginTop: 12 }}>
      {visible && line ? (
        <HostBlock
          host={line.host}
          bubble={<SpeechBubble text={line.text} rows={HOST_BUBBLE_ROWS} />}
        />
      ) : null}
    </View>
  );
}

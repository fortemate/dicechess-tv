import React, { useEffect } from 'react';
import { View } from 'react-native';
import type { Game } from '../../src/core/game';
import { useHostVoice } from '../../native/src/useHostVoice';
import { DEFAULT_HOST, type HostChoice } from '../../native/src/hostSetting';
import { HostBlock, HOST_HEIGHT } from '../../native/src/Matchup';
import { SpeechBubble, HOST_BUBBLE_ROWS } from '../../native/src/SpeechBubble';

/** Reuse Vega's host selection, pacing and presentation for text-only Android commentary. */
export function HostCommentary({
  game,
  host,
  live,
}: {
  game: Game;
  host: HostChoice;
  live: boolean;
}) {
  const line = useHostVoice(game, {
    live,
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
  if (!live || game.mode !== 'hotseat' || host === 'off') return null;
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

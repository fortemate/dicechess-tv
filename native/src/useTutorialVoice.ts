// Thinkle says the tutorial aloud (#264). At each point of a lesson he says its
// lines one after another, each a clip of its own, the next a moment after the
// last has been said, as his bubble shows them all together.
//
// A new point cuts what he was saying: the bubble has already changed, and a
// player who acts before he finishes should hear the words for what is now on
// screen. Leaving the tutorial stops him. The Voices setting is the sound
// module's own: off, `say` is silent and the bubble still shows the words.
import React from 'react';
import type { TutorLine } from '../../src/core/tutorial';
import { LINE_START_MS, speechTiming } from './speechTiming';
import type { Sounds } from './audio';
import { useActivity } from './activity';

export type TutorialVoice = Pick<Sounds, 'say' | 'stopLine'>;

// An estimate for presentation/tests only. Playback follows the decoder's
// completion callback: cold initialization can outlast LINE_START_MS (#482).
export const nextLineMs = (line: TutorLine): number | null => {
  const timing = speechTiming(line);
  return timing ? LINE_START_MS + timing.ms : null;
};

export function useTutorialVoice(
  voice: TutorialVoice | undefined,
  lines: readonly TutorLine[],
): void {
  const { active } = useActivity();
  // The lines change identity on every render; what they say does not.
  const key = lines.map((line) => line.id).join(' ');
  const linesRef = React.useRef(lines);
  React.useLayoutEffect(() => {
    linesRef.current = lines;
  });

  React.useEffect(() => {
    if (!voice || !active) return;
    const said = linesRef.current;
    let cancelled = false;
    const sayFrom = (index: number) => {
      const line = said[index];
      if (!line || cancelled) return;
      voice.say(line, () => {
        if (!cancelled) sayFrom(index + 1);
      });
    };
    sayFrom(0);
    return () => {
      cancelled = true;
      voice.stopLine();
    };
  }, [voice, key, active]);
}

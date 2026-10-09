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
import { LINE_START_MS, speechTiming, type Sounds } from './sound';
import { ActivityContext, afterDelay, scheduleActive } from './activity';

export type TutorialVoice = Pick<Sounds, 'say' | 'stopLine'>;

// When the next line starts, after the one asked for now: the voice player
// takes a moment to start a clip (LINE_START_MS), and speechTiming's tail
// leaves a breath between two sentences. Null when the line has no clip.
export const nextLineMs = (line: TutorLine): number | null => {
  const timing = speechTiming(line);
  return timing ? LINE_START_MS + timing.ms : null;
};

export function useTutorialVoice(
  voice: TutorialVoice | undefined,
  lines: readonly TutorLine[],
): void {
  const activity = React.useContext(ActivityContext);
  // The lines change identity on every render; what they say does not.
  const key = lines.map((line) => line.id).join(' ');
  const linesRef = React.useRef(lines);
  React.useLayoutEffect(() => {
    linesRef.current = lines;
  });

  React.useEffect(() => {
    if (!voice) return;
    const said = linesRef.current;
    let cancel: () => void = () => undefined;
    const sayFrom = (index: number) => {
      const line = said[index];
      if (!line) return;
      voice.say(line);
      const wait = nextLineMs(line);
      // A line without a clip ends what he says: the next would come too soon.
      if (wait !== null && index + 1 < said.length)
        cancel = scheduleActive(
          activity,
          afterDelay,
          () => sayFrom(index + 1),
          wait,
        );
    };
    const cancelStart = scheduleActive(
      activity,
      (run) => run(),
      () => sayFrom(0),
    );
    return () => {
      cancelStart();
      cancel();
      voice.stopLine();
    };
  }, [voice, key, activity]);
}

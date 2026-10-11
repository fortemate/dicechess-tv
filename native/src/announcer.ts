// Telling VoiceView, Fire TV's screen reader, what changed (#257). This is the
// one place that speaks to the platform about it; what to say is worked out
// elsewhere (src/core/announcements.ts, screenSpeech.ts).
//
// VoiceView reads what holds the platform's focus, and nothing here does: the
// remote's focus is the screen reducer's own (useRemoteInput.ts). So the
// screens announce what a sighted player sees change, and only while a screen
// reader is on, so a cursor move costs nothing more without one.
//
// React Native for Vega 0.83 lists announceForAccessibilityWithOptions among
// AccessibilityInfo's implemented methods, with a queue option that lets a line
// wait for the one being said, and asks for the
// com.amazon.devconf.privilege.accessibility privilege, which manifest.toml
// declares. Amazon's accessibility guidance prefers live regions (aria-live)
// and calls announcements deprecated; a live region reads a view whose text
// changes, and none of these lines is on screen.
import React from 'react';
import { AccessibilityInfo } from 'react-native';

// A line to say, and whether it may cut short the one being said: a focus move
// may, so a held arrow is heard where it stops rather than square by square; a
// step of the game waits its turn.
export type Utterance = { text: string; interrupt: boolean };

// Whether a screen reader is on: false until the platform has said so, and
// wherever it cannot say.
export const useScreenReader = (): boolean => {
  const [on, setOn] = React.useState(false);
  React.useEffect(() => {
    let live = true;
    const answer = (value: boolean) => {
      if (live) setOn(value);
    };
    let subscription: { remove(): void } | undefined;
    try {
      AccessibilityInfo.isScreenReaderEnabled().then(answer, () =>
        answer(false),
      );
      subscription = AccessibilityInfo.addEventListener(
        'screenReaderChanged',
        answer,
      );
    } catch {
      // The platform cannot say: nothing is announced.
      answer(false);
    }
    return () => {
      live = false;
      subscription?.remove();
    };
  }, []);
  return on;
};

// Says a line: cutting short what is being said when it may, otherwise after
// it.
export const announce = (line: Utterance | null): void => {
  if (!line) return;
  try {
    // The web test bench's react-native-web has only the plain call, which
    // does nothing there.
    if (
      typeof AccessibilityInfo.announceForAccessibilityWithOptions ===
      'function'
    )
      AccessibilityInfo.announceForAccessibilityWithOptions(line.text, {
        queue: !line.interrupt,
      });
    else AccessibilityInfo.announceForAccessibility(line.text);
  } catch {
    // A platform that cannot announce leaves the game as it was.
  }
};

// Whether the platform asks for less motion, or null until it has answered.
// Where it cannot answer, because the query fails or the platform lacks it, the
// answer is no, and things move. The board's slides (#131) and the dice roll
// (#99) both ask; "A move slides" in native/README.md records what Vega does.
import React from 'react';
import { AccessibilityInfo } from 'react-native';

export const useReducedMotion = (): boolean | null => {
  const [reduced, setReduced] = React.useState<boolean | null>(null);
  React.useEffect(() => {
    let live = true;
    const answer = (value: boolean) => {
      if (live) setReduced(value);
    };
    let subscription: { remove(): void } | undefined;
    try {
      AccessibilityInfo.isReduceMotionEnabled().then(answer, () =>
        answer(false),
      );
      subscription = AccessibilityInfo.addEventListener(
        'reduceMotionChanged',
        answer,
      );
    } catch {
      // The platform does not offer the setting: keep the motion.
      answer(false);
    }
    return () => {
      live = false;
      subscription?.remove();
    };
  }, []);
  return reduced;
};

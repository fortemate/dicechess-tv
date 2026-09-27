// Stand-in for react-native in Node. The real package cannot be imported
// outside a React Native runtime, and these tests are about the tree this
// renderer builds, not about how Vega paints it.
import React from 'react';

export const View = (props) => React.createElement('View', props);
export const Text = (props) => React.createElement('Text', props);
export const useWindowDimensions = () => ({
  width: 960,
  height: 540,
  scale: 2,
  fontScale: 1,
});

// Animated, as far as the board's slide uses it (#131). A slide ends as soon as
// it starts, so a test sees the new position at once. A test that looks at a
// piece in flight sets globalThis.__holdSlides and ends the slides itself
// through globalThis.__heldSlides.
class AnimatedValue {
  constructor(value) {
    this.value = value;
  }
  setValue(value) {
    this.value = value;
  }
  interpolate(config) {
    return { interpolation: config, of: this };
  }
}

export const Animated = {
  Value: AnimatedValue,
  View: (props) => React.createElement('Animated.View', props),
  timing: (value, config) => {
    const entry = { value, config, done: null, stopped: false };
    return {
      start(done) {
        entry.done = done;
        if (globalThis.__holdSlides) {
          globalThis.__heldSlides = [...(globalThis.__heldSlides ?? []), entry];
          return;
        }
        value.setValue(config.toValue);
        done?.({ finished: true });
      },
      stop() {
        entry.stopped = true;
      },
    };
  },
};

export const Easing = {
  out: (easing) => easing,
  cubic: (t) => t,
};

// globalThis.__reduceMotion stands for the platform's setting.
export const AccessibilityInfo = {
  isReduceMotionEnabled: () =>
    Promise.resolve(Boolean(globalThis.__reduceMotion)),
  addEventListener: () => ({ remove() {} }),
};

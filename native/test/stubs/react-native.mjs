// Stand-in for react-native in Node. The real package cannot be imported
// outside a React Native runtime, and these tests are about the tree this
// renderer builds, not about how Vega paints it.
import React from 'react';

export const View = (props) => React.createElement('View', props);
export const Text = (props) => React.createElement('Text', props);
export const Image = (props) => React.createElement('Image', props);
export const Linking = { openURL: () => Promise.resolve() };
export const StyleSheet = {
  create: (styles) => styles,
};
export const useWindowDimensions = () => ({
  width: 960,
  height: 540,
  scale: 2,
  fontScale: 1,
});

// Animated, as far as the board's slide (#131) and the dice roll (#99) use it.
// Delays are not kept: an animation ends as soon as it starts, so a test sees
// the new position at once. A test that looks at a piece in flight or a die on
// its way in sets globalThis.__holdSlides and ends the animations itself
// through globalThis.__heldSlides, calling an entry's done().
//
// As in React Native, an animation ends once: its callback hears
// { finished: true } when it runs to the end, or { finished: false } when
// stop() cuts it short, and nothing after that. Each entry keeps what its
// callback heard in `results`.
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
    let callback = null;
    let started = false;
    let ended = false;
    const entry = {
      value,
      config,
      stopped: false,
      results: [],
      // Ends the animation, once.
      done: (result) => {
        if (!started || ended) return;
        ended = true;
        entry.results.push(result);
        callback?.(result);
      },
    };
    return {
      start(onEnd) {
        callback = onEnd ?? null;
        started = true;
        if (globalThis.__holdSlides) {
          globalThis.__heldSlides = [...(globalThis.__heldSlides ?? []), entry];
          return;
        }
        value.setValue(config.toValue);
        entry.done({ finished: true });
      },
      stop() {
        entry.stopped = true;
        entry.done({ finished: false });
      },
    };
  },
};

export const Easing = {
  out: (easing) => easing,
  cubic: (t) => t,
};

// An answer that is already there: then() calls back at once rather than on a
// later microtask. A resolved Promise settles only after act() has returned
// and the test has gone on, so the app would be tested as it is before the
// platform answers, with nothing moving — which a device shows for a moment at
// most.
const answered = (value) => ({
  then(onAnswer) {
    return answered(onAnswer ? onAnswer(value) : value);
  },
});

// The screen reader's listeners, and those of the reduced motion setting, so a
// test can turn either on or off mid-game.
const readers = new Set();
const motionListeners = new Set();

// Turns the screen reader on or off, as holding Back and Menu does on a
// device. Call it inside act().
export const setScreenReader = (on) => {
  globalThis.__screenReader = on;
  for (const listener of readers) listener(on);
};

// Turns the platform's reduced motion setting on or off, as its accessibility
// settings do on a device. Call it inside act().
export const setReduceMotion = (on) => {
  globalThis.__reduceMotion = on;
  for (const listener of motionListeners) listener(on);
};

// What the app announced since the last reset, in order: the line, and whether
// it waits for the one being said.
export const announced = () => globalThis.__announced ?? [];

export const resetAccessibility = () => {
  readers.clear();
  motionListeners.clear();
  delete globalThis.__screenReader;
  delete globalThis.__announced;
};

// globalThis.__reduceMotion stands for the platform's setting, and
// globalThis.__reduceMotionQuery for how asking for it goes: answered at once
// when unset, 'pending' until globalThis.__answerReduceMotion is called,
// 'fails', or 'throws' as on a platform without the setting.
// globalThis.__screenReader stands for VoiceView: off unless a test turns it
// on, and answered at once.
export const AccessibilityInfo = {
  isScreenReaderEnabled: () => answered(Boolean(globalThis.__screenReader)),
  announceForAccessibilityWithOptions: (text, options) => {
    globalThis.__announced = [
      ...announced(),
      { text, queue: Boolean(options?.queue) },
    ];
  },
  isReduceMotionEnabled: () => {
    const query = globalThis.__reduceMotionQuery;
    if (query === 'throws')
      throw new Error('AccessibilityInfo is not available');
    if (query === 'fails') return Promise.reject(new Error('no answer'));
    if (query === 'pending')
      return new Promise((resolve) => {
        globalThis.__answerReduceMotion = resolve;
      });
    return answered(Boolean(globalThis.__reduceMotion));
  },
  addEventListener: (event, listener) => {
    const listeners =
      event === 'screenReaderChanged'
        ? readers
        : event === 'reduceMotionChanged'
          ? motionListeners
          : null;
    if (!listeners) return { remove() {} };
    listeners.add(listener);
    return {
      remove() {
        listeners.delete(listener);
      },
    };
  },
};

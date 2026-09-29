// The part of react-native-web that native/src/ and the bench use. The package
// ships no types, and native/src/ is typechecked against React Native's own in
// its package; these only keep the bench's code honest.
declare module 'react-native-web' {
  import type { ComponentType, ReactNode } from 'react';

  type Style = Record<string, unknown> | undefined;
  type Props = {
    style?: Style;
    testID?: string;
    children?: ReactNode;
  } & Record<string, unknown>;

  export const View: ComponentType<Props>;
  export const Text: ComponentType<Props>;

  class AnimatedValue {
    constructor(value: number);
    setValue(value: number): void;
    interpolate(config: {
      inputRange: number[];
      outputRange: number[];
    }): unknown;
  }
  type Animation = {
    start(done?: (result: { finished: boolean }) => void): void;
    stop(): void;
  };
  export const Animated: {
    Value: typeof AnimatedValue;
    View: ComponentType<Props>;
    timing(
      value: AnimatedValue,
      config: {
        toValue: number;
        duration: number;
        easing?: (t: number) => number;
        useNativeDriver: boolean;
      },
    ): Animation;
  };
  export namespace Animated {
    type Value = AnimatedValue;
  }
  export const Easing: {
    out(easing: (t: number) => number): (t: number) => number;
    cubic: (t: number) => number;
  };
  export const AccessibilityInfo: {
    isReduceMotionEnabled(): Promise<boolean>;
    addEventListener(
      name: 'reduceMotionChanged',
      handler: (reduced: boolean) => void,
    ): { remove(): void };
  };
}

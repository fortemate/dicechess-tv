// The test-only part of the react-native stub. The app's own imports of
// react-native are typed by the real package.

/** Test-only: turns the screen reader on or off. Call it inside act(). */
export declare function setScreenReader(on: boolean): void;
/** Test-only: turns the reduced motion setting on or off. Call it inside act(). */
export declare function setReduceMotion(on: boolean): void;
/** Test-only: what the app announced, in order, and whether each line waits. */
export declare function announced(): { text: string; queue: boolean }[];
export declare function resetAccessibility(): void;

export declare class MMKV {
  getString(key: string): string | undefined;
  set(key: string, value: string): void;
  delete(key: string): void;
}
/**
 * Test-only: forget everything, as a fresh install would, except that the
 * offer of the tutorial has been answered; `firstLaunch` forgets that too.
 */
export declare function reset(options?: { firstLaunch?: boolean }): void;
/** Test-only: store values as an earlier build left them, before a launch. */
export declare function setStored(values: Record<string, string>): void;

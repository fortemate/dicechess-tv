export declare class MMKV {
  getString(key: string): string | undefined;
  set(key: string, value: string): void;
  delete(key: string): void;
}
/** Test-only: forget everything, as a fresh install would. */
export declare function reset(): void;

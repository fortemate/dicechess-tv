export type HWEvent = { eventType?: string; eventKeyAction?: number };
export declare function useTVEventHandler(
  callback: (event: HWEvent) => void,
): void;
/** Test-only: one full press, down then up. */
export declare function press(eventType: string): void;
/** Test-only: hold a button, repeating the down event without releasing it. */
export declare function hold(eventType: string, repeats?: number): void;
export declare function isSubscribed(): boolean;

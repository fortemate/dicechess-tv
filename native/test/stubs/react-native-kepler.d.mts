export type HWEvent = { eventType?: string; eventKeyAction?: number };
export declare function useTVEventHandler(
  callback: (event: HWEvent) => void,
): void;
/** Test-only: one full press, down then up. */
export declare function press(eventType: string): void;
/** Test-only: hold a button, repeating the down event without releasing it. */
export declare function hold(eventType: string, repeats?: number): void;
/** Test-only: let go of a held button. */
export declare function release(eventType: string): void;
export declare function isSubscribed(): boolean;
/** Test-only: how many screens are listening. */
export declare function listenerCount(): number;

export declare function useKeplerBackHandler(): {
  exitApp(): void;
  addEventListener(
    name: string,
    handler: () => boolean | void,
  ): { remove(): void };
};
/** Test-only: press Back. True when the app claimed it. */
export declare function pressBack(): boolean;
/** Test-only: did an unclaimed Back close the app? */
export declare function hasExited(): boolean;
export declare function clearExit(): void;

export type KeplerAppStateStatus =
  'active' | 'background' | 'inactive' | 'unknown';
export declare function useKeplerAppStateManager(): {
  getCurrentState(): KeplerAppStateStatus;
  addEventListener(
    name: string,
    callback: (state: KeplerAppStateStatus) => void,
  ): { remove(): void };
};
/** Test-only: move the app to another state, as Home or the launcher does. */
export declare function setAppState(state: KeplerAppStateStatus): void;

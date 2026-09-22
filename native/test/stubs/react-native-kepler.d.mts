export declare const UserInputEventName: {
  Up: 'UP';
  Down: 'DOWN';
  Left: 'LEFT';
  Right: 'RIGHT';
  Select: 'SELECT';
  Back: 'BACK';
  Menu: 'MENU';
};
type Listener = (
  eventName: string,
  callback: (event: { phase: 'PRESSED' | 'RELEASED' }) => boolean,
) => { remove(): void };
export declare const useAddUserInputListenerCallback: () => Listener;
export declare const UserInputManager: {
  addListener(
    eventName: string,
    callback: (event: { phase: 'PRESSED' | 'RELEASED' }) => boolean,
  ): { remove(): void };
  removeListeners(): void;
};
/** Test-only: deliver one press for a Vega event name. */
export declare function press(eventName: string): void;
export declare function listenerCount(): number;

import {
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
} from 'react';
import { RemoteInputContext, type RemoteEvent } from './remoteInput';
import type { BoardKey } from '../../src/core/boardInput';
import { ActivityContext } from './activity';

// Directions repeat while the button is held, which is how a cursor should walk
// a board. Select must not, or one press of OK would play several actions.
const REPEATABLE: ReadonlySet<BoardKey> = new Set([
  'up',
  'down',
  'left',
  'right',
]);

export type RemoteInputOptions = {
  // Whether the app handled Back. Returning false lets the system do what Back
  // means at the top of an app, which is to close it — the behavior a TV
  // viewer expects, and not something to suppress.
  onBack?: () => boolean;
  // Whether OK is held down: true when it goes down, false when it comes up,
  // just before the press is delivered. A screen shows its focused item pressed
  // meanwhile, so the press is seen before its choice takes effect (#51).
  onPress?: (pressed: boolean) => void;
  // A different input context (board phase, selection or overlay) cancels OK
  // feedback. Direction keys remain held until release; cursor movement itself
  // must not change this token.
  scope?: string;
};

export function useRemoteInput(
  onKey: (key: BoardKey, repeat: boolean) => void,
  options: RemoteInputOptions = {},
): void {
  const activity = useContext(ActivityContext);
  const remote = useContext(RemoteInputContext);
  if (!remote) throw new Error('Remote input requires a platform provider');
  // Reading the handlers through refs keeps a new callback identity on every
  // render from resubscribing mid-press. The refs are updated once a render has
  // been committed, not while it runs: a render can be thrown away, and a key
  // must never reach a handler from one that was. Layout effects run before any
  // subscription below is made, so no key can arrive before they are set.
  const held = useRef(new Set<BoardKey>());
  const selectHeld = useRef(false);
  const handler = useRef(onKey);
  const back = useRef(options.onBack);
  const press = useRef(options.onPress);
  useLayoutEffect(() => {
    handler.current = onKey;
    back.current = options.onBack;
    press.current = options.onPress;
  });

  const reset = useCallback(() => {
    selectHeld.current = false;
    press.current?.(false);
  }, []);
  useLayoutEffect(reset, [reset, options.scope]);

  // The app's foreground gate (#254): App decides from Vega's app state and
  // focus whether the app is in front, and keys count only while it is.
  useEffect(
    () =>
      activity.subscribe(() => {
        if (!activity.isActive()) reset();
      }),
    [activity, reset],
  );

  useEffect(() => {
    const confirmSelect = (phase: RemoteEvent['phase']): boolean => {
      // Arm once on the physical down. A canceled OK must not re-arm on a
      // repeat after a scope or lifecycle change; only release confirms it.
      if (phase === 'down') {
        const repeat = held.current.has('select');
        held.current.add('select');
        if (!activity.isActive() || repeat) return false;
        selectHeld.current = true;
        press.current?.(true);
        return false;
      }
      held.current.delete('select');
      if (!activity.isActive() || !selectHeld.current) return false;
      selectHeld.current = false;
      press.current?.(false);
      return true;
    };
    return remote.subscribe(({ key, phase }) => {
      if (REPEATABLE.has(key)) {
        // Scope/focus changes are not physical releases. Keep tracking these
        // events while inactive so a continuing hold cannot become a new press.
        if (phase === 'up') held.current.delete(key);
        if (phase !== 'down') return;
        const repeat = held.current.has(key);
        held.current.add(key);
        if (activity.isActive()) handler.current(key, repeat);
        return;
      }
      if (key === 'select' && !confirmSelect(phase)) return;
      if (!activity.isActive()) return;
      if (phase === 'up') handler.current(key, false);
    });
  }, [activity, remote]);

  useEffect(
    () =>
      remote.subscribeBack(() => {
        // Behind an overlay such as Alexa's the game ignores Back like any
        // other key. Leaving it unclaimed would not ignore it: it would close
        // the app while another surface owns the remote.
        if (!activity.isActive()) return true;
        // Without a custom Back policy, deliver Back to the screen reducer.
        if (!back.current) {
          handler.current('back', false);
          return true;
        }
        return back.current();
      }),
    [remote, activity],
  );
}

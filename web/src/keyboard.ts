// The keyboard as the remote. Arrows are the D-pad, Enter or Space is OK, and
// Escape or Backspace is Back. A held key repeats as a held button does: the
// down event again on every repeat, then one release.
//
// Keys typed into the bench's own controls are theirs, not the game's.
import { deliver, pressBack } from './shims/kepler';

const REMOTE: Readonly<Record<string, string>> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  Enter: 'select',
  NumpadEnter: 'select',
  ' ': 'select',
};

const BACK: ReadonlySet<string> = new Set(['Escape', 'Backspace']);

const DOWN = 0;
const UP = 1;

export type KeyboardOptions = {
  // Every press of a remote button, repeats not counted.
  onPress?: (button: string) => void;
  // A key that is not a remote button, for the bench's own shortcuts. Returns
  // whether it was used.
  onOther?: (key: string) => boolean;
  // Any key at all, before anything else sees it. Returns whether it was used.
  onAny?: () => boolean;
};

const isControl = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable ||
    ['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON'].includes(target.tagName));

export function installKeyboard(options: KeyboardOptions = {}): () => void {
  const down = (event: KeyboardEvent) => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (isControl(event.target)) return;
    if (!event.repeat && options.onAny?.()) {
      event.preventDefault();
      return;
    }
    const button = REMOTE[event.key];
    if (button) {
      event.preventDefault();
      if (!event.repeat) options.onPress?.(button);
      deliver({ eventType: button, eventKeyAction: DOWN });
      return;
    }
    if (BACK.has(event.key)) {
      event.preventDefault();
      if (event.repeat) return;
      options.onPress?.('back');
      pressBack();
      return;
    }
    if (!event.repeat && options.onOther?.(event.key)) event.preventDefault();
  };
  const up = (event: KeyboardEvent) => {
    const button = REMOTE[event.key];
    if (!button || isControl(event.target)) return;
    event.preventDefault();
    deliver({ eventType: button, eventKeyAction: UP });
  };
  window.addEventListener('keydown', down);
  window.addEventListener('keyup', up);
  return () => {
    window.removeEventListener('keydown', down);
    window.removeEventListener('keyup', up);
  };
}

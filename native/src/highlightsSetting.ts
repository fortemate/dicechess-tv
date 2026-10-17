// How the board marks movable pieces, the picked-up piece, legal destinations,
// the target under the cursor, the remote's cursor and the last move (#404).
//
// Standard unless the viewer chose otherwise. Anything unreadable reads as
// Standard, the default. Remembered across launches.
import type { KeyValueStore } from './mmkvStore';

export type HighlightStyle =
  'standard' | 'enhanced' | 'colour-blind' | 'high-contrast';

export const DEFAULT_HIGHLIGHTS: HighlightStyle = 'standard';

// The order Settings steps through.
export const HIGHLIGHT_CHOICES: readonly HighlightStyle[] = [
  'standard',
  'enhanced',
  'colour-blind',
  'high-contrast',
];

const NAMES: Readonly<Record<HighlightStyle, string>> = {
  standard: 'Standard',
  enhanced: 'Enhanced',
  'colour-blind': 'Colour-blind',
  'high-contrast': 'High contrast',
};

// What the Settings row says the choice is.
export const highlightsName = (choice: HighlightStyle): string => NAMES[choice];

// The next choice in Settings, or with `step` -1 the one before, round the
// list.
export const cycleHighlights = (
  choice: HighlightStyle,
  step: 1 | -1 = 1,
): HighlightStyle => {
  const count = HIGHLIGHT_CHOICES.length;
  const at = HIGHLIGHT_CHOICES.indexOf(choice);
  return HIGHLIGHT_CHOICES[(at + step + count) % count] ?? DEFAULT_HIGHLIGHTS;
};

const KEY = 'dicechess-tv.highlights.v1';

export const readHighlights = (store: KeyValueStore): HighlightStyle => {
  const stored = store.getString(KEY);
  return (
    HIGHLIGHT_CHOICES.find((choice) => choice === stored) ?? DEFAULT_HIGHLIGHTS
  );
};

export const saveHighlights = (
  store: KeyValueStore,
  choice: HighlightStyle,
): void => store.set(KEY, choice);

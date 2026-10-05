// Whether the first launch's offer of the tutorial has been answered (#244).
//
// Asked once: answered either way, with Learn to play, Skip or Back, it is
// never asked again. Remembered across launches like the other settings, and
// read before the first render, so no launch shows one screen and flips to
// another.
import type { KeyValueStore } from './mmkvStore';

const KEY = 'dicechess-tv.tutorialOffer.v1';

export const readTutorialOffered = (store: KeyValueStore): boolean =>
  store.getString(KEY) === 'answered';

export const saveTutorialOffered = (store: KeyValueStore): void =>
  store.set(KEY, 'answered');

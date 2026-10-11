// What the game screen tells a screen reader (#257), worked out from what it
// showed before and what it shows now. Nothing here speaks: announcer.ts does.
//
// A step of the game is said first, in src/core/announcements.ts's words. Then,
// with a menu or choice open, the item focus is on and its place in the list,
// after the menu's title when it has just opened; on the board, a prompt that
// asks for OK, and the square under the cursor while the person chooses.
import { gameSpeech, sentences } from '../../src/core/announcements';
import type { Game } from '../../src/core/game';
import type { Utterance } from './announcer';

// An open menu or choice as the panel draws it.
export type Choice = {
  title: string;
  note?: string;
  options: readonly string[];
  index: number;
};

export type Heard = {
  game: Game;
  // The open menu or choice, or null on the board.
  choice: Choice | null;
  // On the board: the prompt, when it asks for a press.
  prompt: string | null;
  // On the board: the square under the cursor, named, while the person chooses.
  cursor: string | null;
};

// The focused item and where it stands: "Play a friend, 2 of 6".
export const itemSpeech = ({ options, index }: Choice): string =>
  `${options[index]}, ${index + 1} of ${options.length}`;

// A menu as it opens: its title, its note and the focused item.
const opened = (choice: Choice): string[] => [
  choice.title,
  ...(choice.note ? [choice.note] : []),
  itemSpeech(choice),
];

// A hint on screen separates its parts with a dot; spoken, that is a pause.
export const spokenHint = (hint: string): string =>
  hint.split(' · ').join(', ');

// One utterance for one step of the screen, or null when nothing changed that
// is said. A step of the game waits for what is being said; a move of focus
// alone cuts it short.
export function screenSpeech(
  before: Heard | null,
  now: Heard,
): Utterance | null {
  const game = before ? gameSpeech(before.game, now.game) : [];
  const focus = focusSpeech(before, now);
  if (!game.length && !focus.length) return null;
  return { text: sentences([...game, ...focus]), interrupt: !game.length };
}

function focusSpeech(before: Heard | null, now: Heard): string[] {
  const { choice } = now;
  const was = before?.choice ?? null;
  if (choice) {
    if (!was || was.title !== choice.title) return opened(choice);
    if (was.index !== choice.index) return [itemSpeech(choice)];
    // A setting changed where focus stands: its new value.
    const option = choice.options[choice.index];
    return was.options[was.index] !== option ? [option] : [];
  }
  // Back on the board from a menu, or opened on it, both are said again.
  const back = !before || was !== null;
  const said: string[] = [];
  if (now.prompt && (back || now.prompt !== before?.prompt))
    said.push(spokenHint(now.prompt));
  if (now.cursor && (back || now.cursor !== before?.cursor))
    said.push(now.cursor);
  return said;
}

// Presentation timing from voice metadata, shared without loading a player.
import type { SpokenLine } from './audio';
import { VOICE_FILES } from './voiceFiles';

// A win or a loss is said after its jingle, which lasts about a second, rather
// than over it, and so is the host's result. Every other line is said as it
// happens.
export const RESULT_LINE_DELAY_MS = 1200;
// The events said after the jingle. The host's White or Black win may be one
// of her lines that name no color, whose event is 'win': it waits too.
const AFTER_JINGLE: ReadonlySet<string> = new Set([
  'win',
  'loss',
  'white_wins',
  'black_wins',
  'draw',
]);

// A line counts as said a little after its clip ends, so the music does not
// swell back over its last syllable.
export const LINE_TAIL_MS = 300;
// A line is heard a moment after it is asked for, because the voice player
// loads its clip first. On the Virtual Device each bot's voice began about
// 0.45 s after its bubble showed (#187), so a bubble waits this much more.
export const LINE_START_MS = 600;

// When a line is heard and for how long, or null when it has no clip. The
// speech bubble stays at least this long (#159).
export const speechTiming = (
  line: SpokenLine,
): { delayMs: number; ms: number } | null => {
  const clip = VOICE_FILES[line.id];
  if (!clip) return null;
  const delayMs = AFTER_JINGLE.has(line.event) ? RESULT_LINE_DELAY_MS : 0;
  return { delayMs, ms: Math.round(clip.seconds * 1000) + LINE_TAIL_MS };
};

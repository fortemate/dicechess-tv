// Controls and explanation for the focused Settings row. The compact note fits
// the TV panel; VoiceView gets the same actions in full words. Match the row rather
// than its index, since a build without music omits that row.
const AUDIO = {
  note: 'Left/Right: volume · OK: mute/unmute',
  spokenNote: 'Left and Right change the volume. OK mutes or unmutes.',
};

const SWITCH = {
  note: 'Left: off · Right: on · OK: toggle',
  spokenNote: 'Left switches off. Right switches on. OK toggles.',
};

const CHOICE = {
  note: 'Left/Right or OK: change',
  spokenNote: 'Left, Right or OK change this setting.',
};

const controls = (row: string) => {
  if (/^(Music|Sounds|Voices):/.test(row)) return AUDIO;
  if (
    row.startsWith('Turn board for friends:') ||
    row.startsWith('Auto-play only move:')
  )
    return SWITCH;
  return CHOICE;
};

const description = (row: string): string => {
  if (row.startsWith('Auto-play only move:'))
    return 'Plays the only legal move for you.';
  if (row.startsWith('Play as:')) return 'Your color in new computer games.';
  return '';
};

export const settingsHint = (row: string) => ({
  ...controls(row),
  // Reserve a line below the rows, so their positions stay the same as focus
  // moves. These settings affect gameplay beyond what their short labels say.
  description: description(row),
});

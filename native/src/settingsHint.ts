// Controls and explanation for the focused Settings row. The compact note fits
// the TV panel; VoiceView gets the same actions in full words. Match the row's
// id rather than its index, since a build without music omits that row, and
// rather than its label, which says what the setting is now.
import type { SettingId } from './screen';

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

const controls = (row: SettingId | undefined) => {
  if (row === 'music' || row === 'sounds' || row === 'voices') return AUDIO;
  if (row === 'turn-board' || row === 'auto-select') return SWITCH;
  return CHOICE;
};

const description = (row: SettingId | undefined): string => {
  if (row === 'auto-select') return 'Plays the only legal move for you.';
  if (row === 'play-as') return 'Your color in new computer games.';
  return '';
};

export const settingsHint = (row: SettingId | undefined) => ({
  ...controls(row),
  // Reserve a line below the rows, so their positions stay the same as focus
  // moves. These settings affect gameplay beyond what their short labels say.
  description: description(row),
});

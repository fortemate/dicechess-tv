// Controls for the focused Settings row (#422). The compact note fits the TV
// panel; VoiceView gets the same actions in full words. Match the row rather
// than its index, since a build without music omits that row.
const AUDIO = {
  note: 'Left/Right: volume · OK: mute/unmute',
  spokenNote: 'Left and Right change the volume. OK mutes or unmutes.',
};

const SWITCH = {
  note: 'Left/Right or OK: on/off',
  spokenNote: 'Left, Right or OK switch this on or off.',
};

const CHOICE = {
  note: 'Left/Right or OK: change',
  spokenNote: 'Left, Right or OK change this setting.',
};

export const settingsHint = (row: string) => {
  if (/^(Music|Sounds|Voices):/.test(row)) return AUDIO;
  if (
    row.startsWith('Turn board for friends:') ||
    row.startsWith('Auto-select only choice:')
  )
    return SWITCH;
  return CHOICE;
};

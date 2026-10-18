// The pinned recordings keep their original transcripts for byte and text
// integrity checks. These two spellings sound the same in either dialect;
// present them in en-US without changing the transcript used to select a clip.
// Other wording changes still require a matching recording.
export const voiceCaption = (transcript: string): string =>
  transcript.replace(/\bgrey\b/g, 'gray').replace(/\bfavour\b/g, 'favor');

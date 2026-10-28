// Platform-independent audio contracts. No players or assets are loaded here.
import type { Cue } from '../../src/core/cues';
import type { VoiceLine } from '../../src/core/botVoice';
import type { HostLine } from '../../src/core/hostVoice';
import type { TutorLine } from '../../src/core/tutorial';
import type { Level } from '../../src/core/danger';

export type MusicRole = 'menu' | Level;

// A line someone says: a bot's, the Hot Seat host's, or the tutor's.
export type SpokenLine =
  | Pick<VoiceLine, 'id' | 'event'>
  | Pick<HostLine, 'id' | 'event'>
  | Pick<TutorLine, 'id' | 'event'>;

export type Sounds = {
  // Called on every step of the game, even a silent one: a cue still waiting
  // to start is dropped once the game has moved on.
  play(cues: readonly Cue[]): void;
  setMuted(muted: boolean): void;
  // Linear gain from the sounds setting, 0 to 1 (#398).
  setSoundVolume(gain: number): void;
  // Says a bot's or the host's line in its voice, replacing any line still
  // being said.
  // onEnded runs only after the decoder ends the clip and its tail passes.
  // It never runs after replacement, stop, disabled voices, suspension, failure
  // or timeout. Muting effects with setMuted does not stop speech.
  say(line: SpokenLine, onEnded?: () => void): void;
  // Stops the line being said, or waiting to be said, as a new line would, for
  // a speaker who leaves mid-line: the Hot Seat host turned off (#202).
  stopLine(): void;
  // The Voices setting, for every spoken line, the host's included. Off,
  // nothing is said, and a line being said stops.
  setVoices(on: boolean): void;
  // Linear gain from the voices setting, 0 to 1 (#398).
  setVoiceVolume(gain: number): void;
  // While the app is away from the foreground or out of focus nothing plays,
  // anything playing stops, and a cue or line still waiting is dropped rather
  // than heard on the way back. The effects' players are let go meanwhile and
  // made again on the return. The player's own sound setting is left alone.
  setSuspended(suspended: boolean): void;
  // Lets every player go for good, when the app closes. Nothing plays
  // afterward, whatever it is told.
  dispose(): void;
};

// One track, as the music catalog the build ships describes it: the file under
// the music directory, the stretch that loops (seconds), and the gain that
// levels it with the others.
export type Track = {
  file: string;
  loopStart: number;
  loopEnd: number;
  gainDb: number;
};

export type Catalogue = {
  tracks: Partial<Record<MusicRole, Track>>;
};

export type Music = {
  // What should play now, or nothing. `pauseMs` leaves a silence first, so a
  // result's jingle is heard on its own before the menu theme comes back.
  setRole(role: MusicRole | null, pauseMs?: number): void;
  setEnabled(on: boolean): void;
  // Linear gain from the volume setting, 0 to 1.
  setVolume(gain: number): void;
  // While the app is away from the foreground nothing plays.
  setSuspended(suspended: boolean): void;
  // The catalog arrives after launch, and not at all in a build without music.
  setCatalogue(catalogue: Catalogue | null): void;
  // Lower while a bot's line is being said.
  setDucked(ducked: boolean): void;
  // Lets every player and timer go for good, when the app closes. Nothing
  // plays afterward, whatever it is told.
  dispose(): void;
};

// Initial settings must be applied before a voice or effect can play.
export type SoundConfig = {
  report?: (line: string) => void;
  muted?: boolean;
  soundVolume?: number;
  voices?: boolean;
  voiceVolume?: number;
  suspended?: boolean;
  // True while speaking; false when completed, stopped or suspended.
  onSpeech?: (speaking: boolean) => void;
};

export type MusicConfig = { report?: (line: string) => void };

// Keep one stable services object per mounted app. Factories run after the
// first commit; GameApp owns and disposes the players they return.
export type AudioServices = {
  createSounds(config: SoundConfig): Sounds;
  createMusic(config: MusicConfig): Music;
  // Resolve null for missing, unreadable or invalid music, rather than reject.
  loadCatalogue(): Promise<Catalogue | null>;
};

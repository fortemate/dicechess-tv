// The sounds and the music the screens hold from the first render, before any
// player exists (#313).
//
// Making the players in render ran native work before the first frame was
// drawn, and React may drop a useMemo cache and make them again. So App makes
// the real Sounds and Music in an effect, after the first commit, and attaches
// them here. The screens keep the same object throughout: what they set before
// a real one is attached (the theme from the home screen's first effect, the
// suspension from the app state) is kept and passed on when it is. Thinkle's
// first-launch line comes from a child's effect before App attaches the player:
// keep that current line until attachment, unless it is stopped or silenced.
// Effect cues before attachment are dropped rather than replayed later.
import type { Catalogue, Music, MusicRole, Sounds } from './audio';

export type LateSounds = Sounds & {
  attach(real: Sounds | null): void;
  isSuspended(): boolean;
};
export type LateMusic = Music & { attach(real: Music | null): void };

export function lateSounds(): LateSounds {
  let real: Sounds | null = null;
  let muted: boolean | undefined;
  let soundVolume: number | undefined;
  let voices: boolean | undefined;
  let voiceVolume: number | undefined;
  let suspended: boolean | undefined;
  let pendingLine: Parameters<Sounds['say']> | undefined;
  return {
    isSuspended: () => suspended === true,
    attach(next) {
      real = next;
      if (!next) return;
      if (muted !== undefined) next.setMuted(muted);
      if (soundVolume !== undefined) next.setSoundVolume(soundVolume);
      if (voices !== undefined) next.setVoices(voices);
      if (voiceVolume !== undefined) next.setVoiceVolume(voiceVolume);
      if (suspended !== undefined) next.setSuspended(suspended);
      const line = pendingLine;
      pendingLine = undefined;
      if (line) next.say(...line);
    },
    play: (cues) => real?.play(cues),
    say(line, onEnded) {
      if (real) real.say(line, onEnded);
      else
        pendingLine =
          voices === false || suspended === true ? undefined : [line, onEnded];
    },
    stopLine() {
      pendingLine = undefined;
      real?.stopLine();
    },
    setMuted(value) {
      muted = value;
      real?.setMuted(value);
    },
    setSoundVolume(gain) {
      soundVolume = gain;
      real?.setSoundVolume(gain);
    },
    setVoices(on) {
      voices = on;
      if (!on) pendingLine = undefined;
      real?.setVoices(on);
    },
    setVoiceVolume(gain) {
      voiceVolume = gain;
      real?.setVoiceVolume(gain);
    },
    setSuspended(value) {
      suspended = value;
      if (value) pendingLine = undefined;
      real?.setSuspended(value);
    },
    dispose() {
      pendingLine = undefined;
      real?.dispose();
      real = null;
    },
  };
}

export function lateMusic(): LateMusic {
  let real: Music | null = null;
  let enabled: boolean | undefined;
  let volume: number | undefined;
  let suspended: boolean | undefined;
  let ducked: boolean | undefined;
  let role: { role: MusicRole | null; pauseMs?: number } | undefined;
  let catalogue: { value: Catalogue | null } | undefined;
  return {
    attach(next) {
      real = next;
      if (!next) return;
      if (enabled !== undefined) next.setEnabled(enabled);
      if (volume !== undefined) next.setVolume(volume);
      if (suspended !== undefined) next.setSuspended(suspended);
      if (ducked !== undefined) next.setDucked(ducked);
      // The theme before the catalog, so that the catalog starts it once.
      if (role !== undefined) next.setRole(role.role, role.pauseMs);
      if (catalogue !== undefined) next.setCatalogue(catalogue.value);
    },
    setRole(next, pauseMs) {
      role = { role: next, pauseMs };
      real?.setRole(next, pauseMs);
    },
    setEnabled(on) {
      enabled = on;
      real?.setEnabled(on);
    },
    setVolume(gain) {
      volume = gain;
      real?.setVolume(gain);
    },
    setSuspended(value) {
      suspended = value;
      real?.setSuspended(value);
    },
    setCatalogue(value) {
      catalogue = { value };
      real?.setCatalogue(value);
    },
    setDucked(on) {
      ducked = on;
      real?.setDucked(on);
    },
    dispose() {
      real?.dispose();
      real = null;
    },
  };
}

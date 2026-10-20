// The sounds and the music the screens hold from the first render, before any
// player exists (#313).
//
// Making the players in render ran native work before the first frame was
// drawn, and React may drop a useMemo cache and make them again. So App makes
// the real Sounds and Music in an effect, after the first commit, and attaches
// them here. The screens keep the same object throughout: what they set before
// a real one is attached (the theme from the home screen's first effect, the
// suspension from the app state) is kept and passed on when it is. A cue or a
// line asked for before then is not heard: no player could have been ready
// for it, and none can be asked for before the first press.
import type { Catalogue, Music } from './music';
import type { MusicRole } from './screen';
import type { Sounds } from './sound';

export type LateSounds = Sounds & { attach(real: Sounds | null): void };
export type LateMusic = Music & { attach(real: Music | null): void };

export function lateSounds(): LateSounds {
  let real: Sounds | null = null;
  let muted: boolean | undefined;
  let soundVolume: number | undefined;
  let voices: boolean | undefined;
  let voiceVolume: number | undefined;
  let suspended: boolean | undefined;
  return {
    attach(next) {
      real = next;
      if (!next) return;
      if (muted !== undefined) next.setMuted(muted);
      if (soundVolume !== undefined) next.setSoundVolume(soundVolume);
      if (voices !== undefined) next.setVoices(voices);
      if (voiceVolume !== undefined) next.setVoiceVolume(voiceVolume);
      if (suspended !== undefined) next.setSuspended(suspended);
    },
    play: (cues) => real?.play(cues),
    say: (line) => real?.say(line),
    stopLine: () => real?.stopLine(),
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
      real?.setVoices(on);
    },
    setVoiceVolume(gain) {
      voiceVolume = gain;
      real?.setVoiceVolume(gain);
    },
    setSuspended(value) {
      suspended = value;
      real?.setSuspended(value);
    },
    dispose() {
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
      // The theme before the catalogue, so that the catalogue starts it once.
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

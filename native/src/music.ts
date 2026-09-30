// Plays the adaptive music on Vega (#76): the menu theme away from a game, and
// over one a theme for each level of danger to the king.
//
// What the player can and cannot do was measured on the virtual device first
// (#76, the probe branch probe/76-music-player):
//
// - Its own looping loses about 0.3 s at the first seam, and `ended` comes 0.4 s
//   late. So a track loops on two players taking turns: the next pass starts on
//   the other player just before the loop's end and the two crossfade.
// - `volume` works, and a ramp of 50 ms steps holds its pace. Every fade here is
//   such a ramp, driven by one ticker, on an equal-power curve, so a crossfade
//   does not dip in the middle.
// - A player started at volume zero and moved to its position after `play()`
//   cannot be heard getting there, which is simpler than seeking before the
//   file has loaded.
//
// What the owner chose by ear on the listening page (#76): the seam of a loop
// crossfades over 3 s, which suited every track better than a short splice, and
// a change of level starts the new theme from its beginning, not from the
// middle. A theme still fading out when its level comes back is not new: it
// fades back in from where it is (`canReturn`).
//
// A bot's line ducks the music (#159): it falls by DUCK_DB while the line is
// said, quickly, and comes back more slowly once it has been, so the words are
// heard over the bed rather than against it.
//
// Nothing in here may break the game. Every failure is reported and swallowed.
import {
  AudioPlayer,
  AudioContentType,
  AudioUsageType,
} from '@amazon-devices/react-native-w3cmedia';
import type { MusicRole } from './screen';

// One track, as the music catalogue the build ships describes it: the file under
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
  // The catalogue arrives after launch, and not at all in a build without music.
  setCatalogue(catalogue: Catalogue | null): void;
  // Lower while a bot's line is being said.
  setDucked(ducked: boolean): void;
};

type Player = Pick<
  AudioPlayer,
  'initialize' | 'play' | 'pause' | 'src' | 'currentTime' | 'volume'
>;

export type Clock = {
  now(): number;
  // Runs `run` every `ms`, until the returned function is called.
  every(ms: number, run: () => void): () => void;
  // Runs `run` once after `ms`, unless the returned function is called first.
  after(ms: number, run: () => void): () => void;
};

export type MusicOptions = {
  report?: (line: string) => void;
  // Injected by tests, which cannot hear and cannot wait.
  createPlayer?: () => Player;
  clock?: Clock;
  // Where the build puts the music: assets/music is /pkg/assets/music.
  root?: string;
};

export const TICK_MS = 50;
export const CROSSFADE_MS = 2000;
export const SEAM_MS = 3000;
export const STOP_MS = 500;
export const RESUME_DELAY_MS = 300;
export const RESUME_FADE_MS = 500;
export const END_FADE_MS = 1000;
export const DUCK_DB = -9;
export const DUCK_MS = 200;
export const UNDUCK_MS = 600;

const realClock: Clock = {
  now: () => Date.now(),
  every: (ms, run) => {
    const handle = setInterval(run, ms);
    return () => clearInterval(handle);
  },
  after: (ms, run) => {
    const handle = setTimeout(run, ms);
    return () => clearTimeout(handle);
  },
};

const musicPlayer = (): Player =>
  new AudioPlayer(
    AudioContentType.CONTENT_TYPE_MUSIC,
    AudioUsageType.USAGE_GAME,
  );

type Voice = {
  player: Player;
  role: MusicRole | null;
  track: Track | null;
  // Where the fade is, 0 to 1, where it is heading, and how far per tick.
  fade: number;
  target: number;
  step: number;
  playing: boolean;
  // The seam to the next pass has been started on the other voice.
  seamed: boolean;
};

const gainOf = (db: number): number => Math.min(1, 10 ** (db / 20));

export function createMusic({
  report = () => undefined,
  createPlayer = musicPlayer,
  clock = realClock,
  root = '/pkg/assets/music',
}: MusicOptions = {}): Music {
  let catalogue: Catalogue | null = null;
  let voices: Voice[] | null = null;
  let ready = false;
  // What was asked for.
  let role: MusicRole | null = null;
  let enabled = true;
  let volume = 1;
  let suspended = false;
  // Silence until then, after a result.
  let holdUntil = 0;
  let cancelHold: (() => void) | null = null;
  let cancelResume: (() => void) | null = null;
  let stopTicker: (() => void) | null = null;
  // How far the music is ducked, 0 to 1, and where that is heading.
  let duck = 0;
  let ducked = false;
  // Where each theme was left, so coming back to it continues rather than
  // starting over.
  const positions = new Map<MusicRole, number>();

  const safely = (what: string, run: () => void) => {
    try {
      run();
    } catch (error) {
      report(`music: ${what} failed: ${String(error)}`);
    }
  };

  const apply = (voice: Voice) =>
    safely('volume', () => {
      // Turning music off fades it like any other change, so the switch is not
      // folded in here.
      voice.player.volume = voice.track
        ? volume *
          gainOf(voice.track.gainDb + duck * DUCK_DB) *
          Math.sin((voice.fade * Math.PI) / 2)
        : 0;
    });

  const remember = (voice: Voice) => {
    if (!voice.role || !voice.track) return;
    const at = voice.player.currentTime;
    const { loopStart, loopEnd } = voice.track;
    positions.set(
      voice.role,
      Number.isFinite(at) && at >= loopStart && at < loopEnd - 1
        ? at
        : loopStart,
    );
  };

  const which = (voice: Voice) => voices?.indexOf(voice) ?? -1;

  const stop = (voice: Voice) => {
    if (voice.playing) {
      remember(voice);
      safely('pause', () => voice.player.pause());
      report(`music: player ${which(voice)} stops ${voice.role}`);
    }
    voice.playing = false;
    voice.fade = 0;
    voice.target = 0;
    apply(voice);
  };

  const fadeTo = (voice: Voice, target: number, ms: number) => {
    voice.target = target;
    voice.step = ms <= 0 ? 1 : TICK_MS / ms;
  };

  const begin = (
    voice: Voice,
    next: MusicRole,
    track: Track,
    fadeMs: number,
    from?: number,
  ) => {
    if (voice.playing) stop(voice);
    voice.role = next;
    voice.track = track;
    voice.fade = 0;
    voice.seamed = false;
    fadeTo(voice, 1, fadeMs);
    apply(voice);
    const position = from ?? positions.get(next) ?? track.loopStart;
    report(
      `music: player ${which(voice)} plays ${next} from ${position.toFixed(1)} s, fading in over ${fadeMs} ms`,
    );
    safely('play', () => {
      const src = `${root}/${track.file}`;
      if (voice.player.src !== src) voice.player.src = src;
      void voice.player.play().then(
        () => safely('seek', () => (voice.player.currentTime = position)),
        (error: unknown) => report(`music: play failed: ${String(error)}`),
      );
    });
    voice.playing = true;
    ticking();
  };

  // One tick of a voice's fade. A voice faded out to nothing stops.
  const fadeStep = (voice: Voice) => {
    if (voice.fade === voice.target) return;
    voice.fade =
      voice.fade < voice.target
        ? Math.min(voice.target, voice.fade + voice.step)
        : Math.max(voice.target, voice.fade - voice.step);
    apply(voice);
    if (voice.fade === 0 && voice.target === 0) stop(voice);
  };

  // A pass about to end hands over to a fresh pass on the other voice. Only a
  // voice fully faded in may: one just started can still report the position of
  // the file it played before.
  const handOver = (voice: Voice, other: Voice): boolean => {
    const { role: theme, track } = voice;
    if (!voice.playing || voice.target !== 1 || voice.fade < 1) return false;
    if (voice.seamed || !theme || !track || other.playing) return false;
    if (voice.player.currentTime < track.loopEnd - SEAM_MS / 1000) return false;
    voice.seamed = true;
    report(`music: ${theme} loops`);
    positions.delete(theme);
    begin(other, theme, track, SEAM_MS, track.loopStart);
    fadeTo(voice, 0, SEAM_MS);
    return true;
  };

  // One tick of the duck, which every playing voice follows.
  const duckStep = () => {
    const target = ducked ? 1 : 0;
    if (duck === target || !voices) return;
    const step = TICK_MS / (ducked ? DUCK_MS : UNDUCK_MS);
    duck = ducked ? Math.min(1, duck + step) : Math.max(0, duck - step);
    for (const voice of voices) if (voice.playing) apply(voice);
  };

  const tick = () => {
    if (!voices) return;
    duckStep();
    for (const voice of voices) if (voice.playing) fadeStep(voice);
    const [a, b] = voices;
    if (!handOver(a, b)) handOver(b, a);
    if (voices.some((voice) => voice.playing)) return;
    stopTicker?.();
    stopTicker = null;
    // Nothing is heard, so a duck under way can simply arrive.
    duck = ducked ? 1 : 0;
  };

  const ticking = () => {
    stopTicker ??= clock.every(TICK_MS, tick);
  };

  // How long the music takes to fade away: a result's silence starts a little
  // sooner, and turning music off is quicker than a change of theme.
  const fadeOutMs = (held: boolean): number => {
    if (held) return END_FADE_MS;
    return enabled ? CROSSFADE_MS : STOP_MS;
  };

  // The theme that should be heard now, or null for silence.
  const wanted = (held: boolean): MusicRole | null => {
    if (suspended || !enabled || held || !role) return null;
    return catalogue?.tracks[role] ? role : null;
  };

  const fadeOutAllBut = (keep: Voice | null, ms: number) => {
    for (const voice of voices ?? [])
      if (voice !== keep && voice.playing && voice.target > 0)
        fadeTo(voice, 0, ms);
  };

  // Starts a theme on a voice: a silent one, or the quieter of two playing.
  const startTheme = (want: MusicRole, audible: Voice | undefined) => {
    if (!voices || !catalogue) return;
    const track = catalogue.tracks[want];
    if (!track) return;
    const spare =
      voices.find((voice) => !voice.playing) ??
      voices.reduce(
        (low, voice) => (voice.fade < low.fade ? voice : low),
        voices[0],
      );
    fadeOutAllBut(spare, CROSSFADE_MS);
    // A new level starts its theme from the beginning. A return from the
    // background continues where the music stopped instead.
    begin(
      spare,
      want,
      track,
      audible ? CROSSFADE_MS : CROSSFADE_MS / 2,
      track.loopStart,
    );
  };

  // A theme still fading out when its level comes back fades back in from where
  // it is. It never fell silent, so this is not joining it in the middle, and on
  // two players starting it over would cut one still heard or play the theme
  // twice at once. Only before its seam, though: the old half of a seam has
  // handed over and will not loop again, and a pass that went past its seam
  // while fading out would hand over late, perhaps after its file has ended.
  // Either could leave silence, so such a theme starts over like a new level.
  const canReturn = (voice: Voice): boolean =>
    voice.playing &&
    !voice.seamed &&
    voice.track !== null &&
    voice.player.currentTime < voice.track.loopEnd - SEAM_MS / 1000;

  // Makes what plays agree with what was asked for.
  const reconcile = () => {
    if (!voices || !ready) return;
    const held = clock.now() < holdUntil;
    const want = wanted(held);
    if (want === null) {
      fadeOutAllBut(null, fadeOutMs(held));
      ticking();
      return;
    }
    const audible = voices.find((voice) => voice.playing && voice.target > 0);
    if (audible?.role === want) return;
    const returning = voices.find(
      (voice) => voice.role === want && canReturn(voice),
    );
    if (!returning) return startTheme(want, audible);
    fadeOutAllBut(returning, CROSSFADE_MS);
    fadeTo(returning, 1, CROSSFADE_MS);
    ticking();
  };

  const prepare = () => {
    if (voices || !catalogue) return;
    const created: Voice[] = [];
    try {
      for (let i = 0; i < 2; i++)
        created.push({
          player: createPlayer(),
          role: null,
          track: null,
          fade: 0,
          target: 0,
          step: 0,
          playing: false,
          seamed: false,
        });
    } catch (error) {
      report(`music: player not created: ${String(error)}`);
      return;
    }
    voices = created;
    Promise.all(created.map((voice) => voice.player.initialize())).then(
      () => {
        ready = true;
        reconcile();
      },
      (error: unknown) =>
        report(`music: player not initialised: ${String(error)}`),
    );
  };

  return {
    setRole(next, pauseMs = 0) {
      cancelHold?.();
      cancelHold = null;
      holdUntil = pauseMs > 0 ? clock.now() + pauseMs : 0;
      if (pauseMs > 0)
        cancelHold = clock.after(pauseMs, () => {
          holdUntil = 0;
          cancelHold = null;
          reconcile();
        });
      role = next;
      reconcile();
    },
    setEnabled(on) {
      enabled = on;
      reconcile();
    },
    setVolume(gain) {
      volume = Math.max(0, Math.min(1, gain));
      voices?.forEach(apply);
    },
    setSuspended(value) {
      cancelResume?.();
      cancelResume = null;
      if (value) {
        // Away from the foreground at once, with no fade: Amazon's checks forbid
        // any sound over the launcher.
        if (!suspended) report('music: suspended');
        suspended = true;
        voices?.forEach(stop);
        return;
      }
      // A focus or an active state while the app is already in the foreground
      // changes nothing: resuming would restart what is playing.
      if (!suspended) return;
      // Coming back waits a moment: the system can make an app active for a
      // fifth of a second and take it away again (#76).
      cancelResume = clock.after(RESUME_DELAY_MS, () => {
        cancelResume = null;
        suspended = false;
        if (!voices || !ready) return reconcile();
        const want = role && catalogue?.tracks[role] ? role : null;
        report(want ? `music: resumed on ${want}` : 'music: resumed');
        if (want && enabled && clock.now() >= holdUntil) {
          const spare = voices[0];
          begin(spare, want, catalogue!.tracks[want]!, RESUME_FADE_MS);
        }
      });
    },
    setDucked(on) {
      if (on === ducked) return;
      ducked = on;
      if (voices?.some((voice) => voice.playing)) ticking();
      else duck = on ? 1 : 0;
    },
    setCatalogue(next) {
      const roles = next ? Object.keys(next.tracks).join(', ') : '';
      report(
        next
          ? `music: catalogue with ${roles}`
          : 'music: no catalogue, so no music',
      );
      catalogue = next;
      prepare();
      reconcile();
    },
  };
}

// The catalogue the build writes beside the music, or null when the build has
// none: then the game simply plays without music. fetch reads a packaged file by
// its file:// URL, where the player wants the bare path (native/README.md).
export async function loadCatalogue(
  root = '/pkg/assets/music',
  read: (url: string) => Promise<{ ok: boolean; json(): Promise<unknown> }> = (
    url,
  ) => fetch(url),
): Promise<Catalogue | null> {
  try {
    const response = await read(`file://${root}/music.json`);
    if (!response.ok) return null;
    const data = (await response.json()) as { tracks?: unknown };
    const tracks: Catalogue['tracks'] = {};
    const roles: MusicRole[] = ['menu', 'calm', 'tense', 'critical'];
    for (const each of roles) {
      const track = (data.tracks as Record<string, Track> | undefined)?.[each];
      if (
        track &&
        typeof track.file === 'string' &&
        Number.isFinite(track.loopStart) &&
        Number.isFinite(track.loopEnd) &&
        track.loopEnd > track.loopStart &&
        Number.isFinite(track.gainDb)
      )
        tracks[each] = track;
    }
    return Object.keys(tracks).length ? { tracks } : null;
  } catch {
    return null;
  }
}

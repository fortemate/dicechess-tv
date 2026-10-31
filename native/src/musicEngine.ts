// Shared adaptive music engine, originally qualified on Vega (#76): the menu theme away from a game, and
// over one a theme for each level of danger to the king.
//
// What the player can and cannot do was measured on the virtual device first
// (#76, the probe branch probe/76-music-player):
//
// - Its own looping loses about 0.3 s at the first seam, and `ended` comes 0.4 s
//   late. So a track loops on two voices taking turns: the next pass starts on
//   the other voice just before the loop's end and the two crossfade.
// - On a Fire TV Stick with OS build 2602000051520 (#374), setting `src` on a
//   player that had already played now and then never returned, and the system
//   closed the app as not responding; and a player that had loaded a track kept
//   the Stick's processors busy even paused. So every pass starts on a fresh
//   player, from two kept ready, and a voice lets its player go when it stops.
// - `volume` works, and a ramp of 50 ms steps holds its pace. Every fade here is
//   such a ramp, driven by one ticker, on an equal-power curve, so a crossfade
//   does not dip in the middle. The ticker runs only while a fade or the duck
//   moves, or a pass waits to be heard (#313): once the music has settled, one
//   timer is armed for the loop's seam and nothing else wakes the JavaScript
//   thread.
// - On a Fire TV Stick the ticker can be held up for a second and more while
//   the danger search runs at the start of a turn (#365). A fade moved a step a
//   tick then stretched a 2 s crossfade to 12 s or more (#376). So every fade,
//   and the duck, is worked out from the clock: a late tick finds it where it
//   should be by then, and only its steps are coarser.
// - A fresh player there is heard about a second after `play()` resolves: its
//   position stays put until then. So a pass's fade-in starts once its position
//   moves, and what it replaces keeps playing until then (#376).
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
import type { MusicRole, Music, Track, Catalogue, MusicConfig } from './audio';
export type { Music, Track, Catalogue } from './audio';

export type MusicPlayer = {
  initialize(): Promise<void>;
  deinitialize(): Promise<void>;
  play(): Promise<void>;
  src: string;
  currentTime: number;
  volume: number;
  readonly duration: number;
  addEventListener(event: string, listener: () => void): void;
  removeEventListener(event: string, listener: () => void): void;
};
type Player = MusicPlayer;

export type Clock = {
  now(): number;
  // Runs `run` every `ms`, until the returned function is called.
  every(ms: number, run: () => void): () => void;
  // Runs `run` once after `ms`, unless the returned function is called first.
  after(ms: number, run: () => void): () => void;
};

export type MusicOptions = MusicConfig & {
  // Injected by tests, which cannot hear and cannot wait.
  createPlayer: () => Player;
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
// How long a pass may take to be heard before it fails, keeping working music.
// Only the time the ticker saw counts, at most START_TICK_MS a tick: when the
// danger or the bot's search holds the JavaScript thread for 0.7 to 2.7 s on a
// Fire TV Stick (#365), it holds the play() request and its events too, so
// that time is not the player's.
export const START_WAIT_MS = 2000;
export const START_TICK_MS = 4 * TICK_MS;
// A seam's timer that finds the player not there yet, its position behind the
// clock, looks again this much later at the soonest.
export const SEAM_RETRY_MS = 250;
// Constructed players kept ready: enough for a change of level during a seam.
export const SPARE_PLAYERS = 2;

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

type Voice = {
  // The player of the pass on this voice, or null while it is silent.
  player: Player | null;
  role: MusicRole | null;
  track: Track | null;
  // Where the fade is, 0 to 1, and where it is heading. It moves a whole way
  // in `ms`, from `from` at `since`.
  fade: number;
  target: number;
  from: number;
  since: number;
  ms: number;
  // A pass not heard yet waits, silent, for its position to move from
  // `startAt`. Then its fade-in starts,
  // and so does the fading out of what it replaces (`onStart`).
  waiting: boolean;
  startAt: number;
  waitSince: number;
  // How much of the start wait the ticker saw, and when it last looked.
  waited: number;
  seenAt: number;
  // The pass is the next one of a loop, started at its seam.
  seam: boolean;
  onStart: ((at: number) => void)[];
  playing: boolean;
  // The seam to the next pass has been started on the other voice.
  seamed: boolean;
  started: boolean;
  detach: () => void;
  fail: ((error: unknown) => void) | null;
};

const gainOf = (db: number): number => Math.min(1, 10 ** (db / 20));

export function createMusic({
  report = () => undefined,
  createPlayer,
  clock = realClock,
  root = '/pkg/assets/music',
}: MusicOptions): Music {
  let catalogue: Catalogue | null = null;
  let voices: Voice[] | null = null;
  let ready = false;
  // What was asked for.
  let role: MusicRole | null = null;
  let enabled = true;
  let volume = 1;
  let suspended = false;
  // Retry a failed theme only on an explicit request or foreground return,
  // rather than making an unbounded stream of players for a broken decoder.
  let failedRole: MusicRole | null = null;
  // A seam that fails is tried once more before its theme counts as failed:
  // a failure there leaves silence once the old pass ends.
  let seamRetried: MusicRole | null = null;
  // Silence until then, after a result.
  let holdUntil = 0;
  let cancelHold: (() => void) | null = null;
  let cancelResume: (() => void) | null = null;
  let stopTicker: (() => void) | null = null;
  // The one timer kept while nothing moves: it wakes the music for its seam.
  let cancelSeam: (() => void) | null = null;
  let disposed = false;
  // How far the music is ducked, 0 to 1, and where that is heading. It moves
  // from `duckFrom` at `duckSince`, when the duck last turned.
  let duck = 0;
  let ducked = false;
  let duckFrom = 0;
  let duckSince = 0;
  const duckAt = (now: number) => {
    const moved = (now - duckSince) / (ducked ? DUCK_MS : UNDUCK_MS);
    return ducked
      ? Math.min(1, duckFrom + moved)
      : Math.max(0, duckFrom - moved);
  };
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
      if (!voice.player) return;
      // Turning music off fades it like any other change, so the switch is not
      // folded in here.
      voice.player.volume = voice.track
        ? volume *
          gainOf(voice.track.gainDb + duck * DUCK_DB) *
          Math.sin((voice.fade * Math.PI) / 2)
        : 0;
    });

  const remember = (voice: Voice) => {
    if (!voice.role || !voice.track || !voice.player) return;
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

  // Constructed spares have no native pipeline until a pass is requested.
  const spares: Player[] = [];

  // A voice that stops lets its player go: one that has loaded a track keeps
  // working even paused.
  const stop = (voice: Voice) => {
    if (voice.playing) {
      safely('position', () => remember(voice));
      report(`music: player ${which(voice)} stops ${voice.role}`);
    }
    voice.playing = false;
    voice.fade = 0;
    voice.target = 0;
    voice.from = 0;
    voice.waiting = false;
    voice.onStart = [];
    voice.started = false;
    voice.fail = null;
    const player = voice.player;
    voice.player = null;
    if (!player) return;
    safely('listeners', voice.detach);
    voice.detach = () => undefined;
    // Immediate silence also covers Home. Do not pause an ended pipeline
    // before releasing it: that stalls GStreamer on the updated Stick.
    safely('mute', () => (player.volume = 0));
    safely('release', () => {
      player
        .deinitialize()
        .catch((error: unknown) =>
          report(`music: player not released: ${String(error)}`),
        );
    });
  };

  // Where a voice's fade is at `now`.
  const fadeAt = (voice: Voice, now: number) => {
    const moved = voice.ms <= 0 ? 1 : Math.max(0, now - voice.since) / voice.ms;
    return voice.from < voice.target
      ? Math.min(voice.target, voice.from + moved)
      : Math.max(voice.target, voice.from - moved);
  };

  // A fade turned on its way starts from where it is at that moment, not where
  // the last tick left it. The moment is now, unless a pass heard a little
  // before the tick that noticed dates it back.
  const fadeTo = (
    voice: Voice,
    target: number,
    ms: number,
    at = clock.now(),
  ) => {
    if (voice.fade !== voice.target) voice.fade = fadeAt(voice, at);
    voice.from = voice.fade;
    voice.target = target;
    voice.since = at;
    voice.ms = ms;
    // A fade only moves while the ticker runs.
    ticking();
  };

  // Starts a pass on a voice, on a fresh player. False when none is ready yet:
  // the music catches up once one is.
  const begin = (
    voice: Voice,
    next: MusicRole,
    track: Track,
    fadeMs: number,
    from?: number,
    seam = false,
  ): boolean => {
    const player = spares.shift();
    if (!player) return false;
    refill();
    stop(voice);
    voice.player = player;
    voice.role = next;
    voice.track = track;
    voice.fade = 0;
    voice.seamed = false;
    fadeTo(voice, 1, fadeMs);
    apply(voice);
    const position = from ?? positions.get(next) ?? track.loopStart;
    voice.waiting = true;
    voice.startAt = position;
    voice.waitSince = clock.now();
    voice.waited = 0;
    voice.seenAt = voice.waitSince;
    voice.seam = seam;
    voice.onStart = [];
    report(
      `music: player ${which(voice)} plays ${next} from ${position.toFixed(1)} s, fading in over ${fadeMs} ms`,
    );
    voice.playing = true;
    const failed = (error: unknown) => {
      if (voice.player !== player) return;
      report(`music: play failed: ${String(error)}`);
      if (seam && seamRetried !== next) seamRetried = next;
      else failedRole = next;
      // A failed pass has no position worth remembering.
      voice.playing = false;
      stop(voice);
      if (wanted(clock.now() < holdUntil) === null) return;
      for (const other of voices ?? []) {
        if (other === voice || !other.playing || other.waiting) continue;
        other.seamed = false;
        fadeTo(other, 1, CROSSFADE_MS);
      }
    };
    voice.fail = failed;
    const onError = () => failed('media error');
    const onEnded = () => {
      // Let the native end notification return before destroying its player.
      // If a seam failed, the old pass still needs releasing at its own EOF.
      clock.after(0, () => {
        if (voice.player !== player) return;
        stop(voice);
        reconcile();
      });
    };
    const onPlaying = () => {
      if (voice.player !== player || voice.started) return;
      voice.started = true;
      try {
        // Seeking after playing has actual metadata avoids another load/seek
        // race. The pass is still silent until its position moves from here.
        if (position > 0) player.currentTime = position;
      } catch (error) {
        failed(error);
      }
    };
    let requested = false;
    const onCanPlay = () => {
      if (voice.player !== player || requested) return;
      try {
        if (!Number.isFinite(player.duration) || player.duration <= 0) return;
        requested = true;
        void player.play().catch(failed);
      } catch (error) {
        failed(error);
      }
    };
    voice.detach = () => {
      player.removeEventListener('error', onError);
      player.removeEventListener('ended', onEnded);
      player.removeEventListener('playing', onPlaying);
      player.removeEventListener('canplay', onCanPlay);
    };
    try {
      player.addEventListener('error', onError);
      player.addEventListener('ended', onEnded);
      player.addEventListener('playing', onPlaying);
      player.addEventListener('canplay', onCanPlay);
      void player.initialize().then(() => {
        if (voice.player !== player) return;
        try {
          player.src = `${root}/${track.file}`;
        } catch (error) {
          failed(error);
        }
      }, failed);
    } catch (error) {
      failed(error);
      return false;
    }
    ticking();
    return true;
  };

  // One tick of a voice's fade. A voice faded out to nothing stops.
  const fadeStep = (voice: Voice, now: number) => {
    if (voice.waiting) {
      // Turned away before it was heard, a pass simply stops.
      if (voice.target === 0) stop(voice);
      return;
    }
    if (voice.fade === voice.target) return;
    voice.fade = fadeAt(voice, now);
    apply(voice);
    if (voice.fade === 0 && voice.target === 0) stop(voice);
  };

  // A pass is heard once its player's position moves. Its fade-in is dated from
  // then, as near as the position tells, and only then does what it replaces
  // start to fade out. A pass with no progress times out instead of replacing
  // audible music with silence when the media stack never sends an error.
  const heard = (voice: Voice, now: number) => {
    if (!voice.waiting || !voice.player || voice.target === 0) return;
    const at = voice.player.currentTime;
    const moved =
      voice.started && Number.isFinite(at) && at > voice.startAt + 0.01;
    if (!moved) {
      voice.waited += Math.min(START_TICK_MS, Math.max(0, now - voice.seenAt));
      voice.seenAt = now;
      if (voice.waited >= START_WAIT_MS) voice.fail?.('playback did not start');
      return;
    }
    // Any pass heard ends the retry: one that failed before a suspension is
    // not held against the next seam.
    seamRetried = null;
    const began = Math.max(voice.waitSince, now - (at - voice.startAt) * 1000);
    voice.waiting = false;
    voice.fade = 0;
    voice.from = 0;
    voice.since = began;
    const replaced = voice.onStart;
    voice.onStart = [];
    for (const run of replaced) run(began);
  };

  // A pass about to end hands over to a fresh pass on the other voice. Only a
  // voice fully faded in may: one just started can still report the position of
  // the file it played before.
  const handOver = (voice: Voice, other: Voice): boolean => {
    const { role: theme, track } = voice;
    if (!voice.playing || voice.target !== 1 || voice.fade < 1) return false;
    if (
      voice.seamed ||
      !theme ||
      !track ||
      other.playing ||
      failedRole === theme
    )
      return false;
    const player = voice.player;
    if (!player) return false;
    if (player.currentTime < track.loopEnd - SEAM_MS / 1000) return false;
    // Without a fresh player the seam waits for the next tick.
    if (!begin(other, theme, track, SEAM_MS, track.loopStart, true))
      return false;
    voice.seamed = true;
    report(`music: ${theme} loops`);
    positions.delete(theme);
    // The old pass plays on until the new one is heard, then fades out by its
    // loop's end, where a track may end too.
    other.onStart.push(() => {
      if (voice.player !== player || !voice.playing) return;
      const left = (track.loopEnd - player.currentTime) * 1000;
      fadeTo(voice, 0, Math.max(0, Math.min(SEAM_MS, left)));
    });
    return true;
  };

  // One tick of the duck, which every playing voice follows.
  const duckStep = (now: number) => {
    const target = ducked ? 1 : 0;
    if (duck === target || !voices) return;
    duck = duckAt(now);
    for (const voice of voices) if (voice.playing) apply(voice);
  };

  const tick = () => {
    if (!voices) return;
    const now = clock.now();
    duckStep(now);
    // Every pass heard by now is noticed first, so what it replaces fades out
    // from the same tick.
    for (const voice of voices) if (voice.playing) heard(voice, now);
    for (const voice of voices) if (voice.playing) fadeStep(voice, now);
    seam();
    if (moving()) return;
    stopTicker?.();
    stopTicker = null;
    if (!voices.some((voice) => voice.playing)) {
      // Nothing is heard, so a duck under way can simply arrive.
      duck = ducked ? 1 : 0;
      duckFrom = duck;
    }
    armSeam();
  };

  // A pass about to end hands over to the other voice, whichever it is.
  const seam = () => {
    if (!voices) return;
    const [a, b] = voices;
    if (!handOver(a, b)) handOver(b, a);
  };

  // Whether anything heard is on its way somewhere: a pass waiting to be heard,
  // a fade, or the duck under a playing theme. Only then does the ticker run.
  const moving = () => {
    if (!voices) return false;
    const playing = voices.filter((voice) => voice.playing);
    return (
      playing.some((voice) => voice.waiting || voice.fade !== voice.target) ||
      (playing.length > 0 && duck !== (ducked ? 1 : 0))
    );
  };

  const ticking = () => {
    if (disposed) return;
    cancelSeam?.();
    cancelSeam = null;
    stopTicker ??= clock.every(TICK_MS, tick);
  };

  // With nothing moving, the music sleeps until the seam of the theme heard, as
  // far as its player's position says; a timer that finds it short of there
  // looks again. The seam itself starts the ticker for its crossfade.
  const armSeam = () => {
    cancelSeam?.();
    cancelSeam = null;
    if (disposed || !voices) return;
    let wait = Infinity;
    for (const voice of voices) {
      const { player, track } = voice;
      if (!voice.playing || voice.seamed || !player || !track) continue;
      const at = player.currentTime;
      const left = Number.isFinite(at)
        ? (track.loopEnd - SEAM_MS / 1000 - at) * 1000
        : SEAM_RETRY_MS;
      wait = Math.min(wait, Math.max(SEAM_RETRY_MS, left));
    }
    if (wait === Infinity) return;
    cancelSeam = clock.after(wait, () => {
      cancelSeam = null;
      seam();
      if (moving()) ticking();
      else armSeam();
    });
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
    // Without a fresh player the theme starts once one is ready.
    if (!track || !spares.length) return;
    const spare =
      voices.find((voice) => !voice.playing) ??
      voices.reduce(
        (low, voice) => (voice.fade < low.fade ? voice : low),
        voices[0],
      );
    // What plays now keeps playing until the new theme is heard.
    const replaced = voices
      .filter((voice) => voice !== spare && voice.playing && voice.target > 0)
      .map((voice) => ({ voice, player: voice.player }));
    // A new level starts its theme from the beginning. A return from the
    // background continues where the music stopped instead.
    const started = begin(
      spare,
      want,
      track,
      audible ? CROSSFADE_MS : CROSSFADE_MS / 2,
      track.loopStart,
    );
    if (!started) return;
    spare.onStart.push((at) => {
      for (const { voice, player } of replaced)
        if (voice.player === player && voice.playing && voice.target > 0)
          fadeTo(voice, 0, CROSSFADE_MS, at);
    });
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
    voice.player !== null &&
    voice.player.currentTime < voice.track.loopEnd - SEAM_MS / 1000;

  // Makes what plays agree with what was asked for.
  const reconcile = () => {
    if (disposed || !voices || !ready) return;
    const held = clock.now() < holdUntil;
    const want = wanted(held);
    if (want === null) {
      fadeOutAllBut(null, fadeOutMs(held));
      ticking();
      return;
    }
    if (want === failedRole) return;
    // The wanted theme, heard or waiting to be: any other theme still on its
    // way in is turned away. One already fading in or out is left alone.
    const onItsWay = voices.some(
      (voice) => voice.playing && voice.target > 0 && voice.role === want,
    );
    if (onItsWay) {
      for (const voice of voices)
        if (voice.role !== want && voice.waiting && voice.target > 0)
          fadeTo(voice, 0, CROSSFADE_MS);
      return;
    }
    const audible = voices.find((voice) => voice.playing && voice.target > 0);
    const returning = voices.find(
      (voice) => voice.role === want && canReturn(voice),
    );
    if (!returning) return startTheme(want, audible);
    fadeOutAllBut(returning, CROSSFADE_MS);
    fadeTo(returning, 1, CROSSFADE_MS);
    ticking();
  };

  // Keeps lightweight players ready; native initialization waits for a pass.
  function refill() {
    while (spares.length < SPARE_PLAYERS) {
      let player: Player;
      try {
        player = createPlayer();
      } catch (error) {
        report(`music: player not created: ${String(error)}`);
        return;
      }
      spares.push(player);
      ready = true;
    }
  }

  const prepare = () => {
    if (voices || !catalogue) return;
    voices = [0, 1].map(() => ({
      player: null,
      role: null,
      track: null,
      fade: 0,
      target: 0,
      from: 0,
      since: 0,
      ms: 0,
      waiting: false,
      startAt: 0,
      waitSince: 0,
      waited: 0,
      seenAt: 0,
      seam: false,
      onStart: [],
      playing: false,
      seamed: false,
      started: false,
      detach: () => undefined,
      fail: null,
    }));
    refill();
  };

  return {
    setRole(next, pauseMs = 0) {
      if (disposed) return;
      failedRole = null;
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
      if (enabled !== on) failedRole = null;
      enabled = on;
      reconcile();
    },
    setVolume(gain) {
      volume = Math.max(0, Math.min(1, gain));
      voices?.forEach(apply);
    },
    setSuspended(value) {
      if (disposed) return;
      cancelResume?.();
      cancelResume = null;
      if (value) {
        // Away from the foreground at once, with no fade: Amazon's checks forbid
        // any sound over the launcher.
        if (!suspended) report('music: suspended');
        suspended = true;
        voices?.forEach(stop);
        // Nothing plays, so nothing needs waking until the return.
        stopTicker?.();
        stopTicker = null;
        cancelSeam?.();
        cancelSeam = null;
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
        failedRole = null;
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
      const now = clock.now();
      const heard = voices?.some((voice) => voice.playing) ?? false;
      // Turned on its way, the duck moves on from where it is now. With nothing
      // heard it can simply arrive.
      if (heard) duck = duckAt(now);
      else duck = on ? 1 : 0;
      duckFrom = duck;
      duckSince = now;
      ducked = on;
      if (heard) ticking();
    },
    setCatalogue(next) {
      if (disposed) return;
      failedRole = null;
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
    dispose() {
      if (disposed) return;
      disposed = true;
      report('music: disposed');
      for (const cancel of [cancelHold, cancelResume, stopTicker, cancelSeam])
        cancel?.();
      cancelHold = cancelResume = stopTicker = cancelSeam = null;
      voices?.forEach(stop);
      // Constructed spares never opened a pipeline: there is nothing to release.
      spares.length = 0;
    },
  };
}

// The catalog the build writes beside the music, or null when the build has
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

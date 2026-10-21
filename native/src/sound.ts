// Plays the game's cues on Vega.
//
// The route was measured on the virtual device before this was written — see
// "Sound" in native/README.md. An AudioPlayer constructed as SONIFICATION/GAME,
// a plain path rather than a URL, and a replay that pauses and rewinds first,
// because calling play() again on a finished clip was heard to do nothing.
//
// No player is ever given a second clip (#374). On a Fire TV Stick with OS
// build 2602000051520, setting `src` on a player that had already played took
// about 100 ms, and now and then never returned: the JavaScript thread waited
// inside the media player until the system closed the app as not responding.
// A player kept for every file never hung, but thirteen players that had played
// kept the Stick's processors busy; a fresh player for every cue, let go after,
// left more and more behind it until the system closed the app again.
//
// So the effects are joined into one file, an audio sprite, as Amazon advises
// for games (scripts/sprite-effects.mjs). The cues go out on three channels,
// each with one player that loads the sprite once, plays a cue's clip and is
// paused once the clip is over. A capture and the win it causes are heard
// together, because they are on different channels; a new move on the same
// channel cuts the last one short instead of piling sounds up.
//
// The channels' players are let go while the app is away from the foreground,
// and made again on the way back (#313). On a Fire TV Stick a loaded player
// holds memory and processor time even paused, and the system ends an app in
// the background that does not give its memory back. They are let go without a
// pause() first: a pause just before deinitialize() stalled the media pipeline
// there for seconds (#386).
//
// A seek takes the media pipeline a moment, and one asked for just before
// play() was heard to lose the start of a clip on the virtual device, now and
// then the whole clip. So between clips each channel's player waits, paused, at
// the start of a take of the cue it plays most, chosen in advance: that cue
// then only has to play. Any other cue seeks first. A player is moved only once
// it has played, as the music's are: the first wait, set as the sprite loaded,
// left the first cues silent there. So each player first plays a moment of the
// silence the sprite opens with, at volume zero, and waits from then on.
//
// The lines are the bots' (#159), the Hot Seat host's (#202), and Thinkle's as
// he teaches the tutorial (#264). The voices have a setting of their own, so
// turning the effects off leaves the voices, and the other way round; a new line
// replaces the one being said, and neither cuts nor is cut by a cue. The app is
// told when a line starts and ends, so the music can duck under it.
//
// Nothing in here may break the game. Every failure is reported and swallowed:
// a game that plays silently is a bug, a game that stops is a worse one.
import {
  AudioPlayer,
  AudioContentType,
  AudioUsageType,
} from '@amazon-devices/react-native-w3cmedia';
import type { Cue } from '../../src/core/cues';
import type { VoiceLine } from '../../src/core/botVoice';
import type { HostLine } from '../../src/core/hostVoice';
import type { TutorLine } from '../../src/core/tutorial';
import { CUE_FILES } from './cueFiles';
import { EFFECT_CLIPS, EFFECT_SPRITE } from './effectSprite';
import { VOICE_FILES } from './voiceFiles';

// Where the build copies the vendored files: `assets/` in the package is `/pkg/`
// at run time. A file:// URL for the same file fails; the bare path plays.
const ROOT = '/pkg/assets/sfx';
const VOICES = '/pkg/assets/voices';

type Channel = 'board' | 'dice' | 'result';

const CHANNEL: Readonly<Record<Cue, Channel>> = {
  piece_move: 'board',
  piece_capture: 'board',
  castle: 'board',
  promotion: 'board',
  dice_roll: 'dice',
  turn_handoff: 'dice',
  // Not on the dice channel, where it would cut short the clatter it follows.
  // Nothing else plays on the result channel then: a roll that ends the game
  // is heard as the result instead.
  no_move: 'result',
  game_win: 'result',
  game_loss: 'result',
  game_draw: 'result',
};

// Cues that wait before they start, in milliseconds. A roll with nothing to
// play is heard after the dice land, not over them: the throws last 0.4 to
// 0.6 s (#85).
export const CUE_DELAY_MS: Partial<Record<Cue, number>> = { no_move: 500 };

const CHANNELS: readonly Channel[] = ['board', 'dice', 'result'];

// The cue a channel's player waits for between clips: the one it plays most.
const MAIN_CUE: Readonly<Record<Channel, Cue>> = {
  board: 'piece_move',
  dice: 'dice_roll',
  result: 'no_move',
};

// A clip starts this early, in the silence before it, so the start of the clip
// is heard whether or not the decoder counts the MP3's own delay.
export const CLIP_LEAD_SECONDS = 0.05;
// A clip is paused this long after it ends, still inside the 2 s of silence that
// follows it in the sprite.
export const CLIP_TAIL_MS = 250;
// Constructed players kept ready for the next line; no empty native pipeline.
export const SPARE_PLAYERS = 2;
// How long after the return to the foreground the channels' players are made
// again, unless a cue needs one sooner. The system can make an app active for
// a fifth of a second and take it away again (#76), and a Fire TV Stick has
// ended the app for its memory in the moment it came back (#478).
export const EFFECTS_RETURN_MS = 1000;

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

// A line someone says: a bot's, the Hot Seat host's, or the tutor's.
export type SpokenLine =
  | Pick<VoiceLine, 'id' | 'event'>
  | Pick<HostLine, 'id' | 'event'>
  | Pick<TutorLine, 'id' | 'event'>;

// A line counts as said a little after its clip ends, so the music does not
// swell back over its last syllable.
export const LINE_TAIL_MS = 300;
// A missing ended/error event must not keep a loaded player and the music's
// duck forever. This is a watchdog, not the normal deadline for a spoken line.
export const LINE_TIMEOUT_MS = 10_000;
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

export type SoundOptions = {
  // Which of several takes to play. Injected so a test can know.
  pick?: (count: number) => number;
  // Where failures go, since they are never thrown.
  report?: (line: string) => void;
  // Start muted, when the viewer turned sound off in an earlier session.
  muted?: boolean;
  // Initial linear gain for effects, 0 to 1 (#398).
  soundVolume?: number;
  // Runs a delayed cue after `wait` milliseconds. Injected so a test need not
  // wait.
  later?: (run: () => void, wait: number) => void;
  // Start with the bots' voices off, when the viewer turned them off earlier.
  voices?: boolean;
  // Initial linear gain for voices, 0 to 1 (#398).
  voiceVolume?: number;
  // A launch away from the foreground must not open effect pipelines.
  suspended?: boolean;
  // Pauses a cue's clip after `wait` milliseconds, once it is over. Injected so
  // a test can hold it.
  endClip?: (run: () => void, wait: number) => void;
  // Told true when a line starts to be heard and false when it has been said or
  // stopped, so the music can duck under it.
  onSpeech?: (speaking: boolean) => void;
  // Makes the effects' players again `wait` milliseconds after the return to
  // the foreground; the returned function cancels it. Injected so a test can
  // say when.
  wake?: (run: () => void, wait: number) => () => void;
};

type Player = Pick<
  AudioPlayer,
  | 'initialize'
  | 'deinitialize'
  | 'play'
  | 'pause'
  | 'src'
  | 'currentTime'
  | 'volume'
  | 'duration'
  | 'addEventListener'
  | 'removeEventListener'
>;

export function createSounds({
  pick = (count) => Math.floor(Math.random() * count),
  report = () => undefined,
  muted: startMuted = false,
  soundVolume: startSoundVolume = 1,
  later = (run, wait) => {
    setTimeout(run, wait);
  },
  voices: startVoices = true,
  voiceVolume: startVoiceVolume = 1,
  suspended: startSuspended = false,
  onSpeech = () => undefined,
  endClip = (run, wait) => {
    setTimeout(run, wait);
  },
  wake = (run, wait) => {
    const timer = setTimeout(run, wait);
    return () => clearTimeout(timer);
  },
}: SoundOptions = {}): Sounds {
  let muted = startMuted;
  let soundGain = Math.max(0, Math.min(1, startSoundVolume));
  let voices = startVoices;
  let voiceGain = Math.max(0, Math.min(1, startVoiceVolume));
  let suspended = startSuspended;
  let disposed = false;
  // Counts the times the app went away. A cue asked for before the last of
  // them is never heard, even if the app is back by the time its player is
  // ready or its wait is over (#254).
  let suspension = 0;
  // Counts the steps play() has been told about. A delayed cue starts only if
  // no step came after its own, so a resignation's jingle on the result player
  // is not cut short by the empty roll just before it.
  let steps = 0;
  // Counts the lines asked for. A line waiting or being said is still the
  // current one only while no other came after it, and nothing stopped it.
  let lines = 0;
  // Counts the times the channels' players were let go. Whatever an earlier
  // set of players was in the middle of is forgotten.
  let lease = 0;
  let speaking = false;
  const speech = (on: boolean) => {
    if (speaking === on) return;
    speaking = on;
    onSpeech(on);
  };

  const makePlayer = (name: string): Player | null => {
    try {
      return new AudioPlayer(
        AudioContentType.CONTENT_TYPE_SONIFICATION,
        AudioUsageType.USAGE_GAME,
      );
    } catch (error) {
      report(`sound: ${name} player not created: ${String(error)}`);
      return null;
    }
  };
  // Effects keep their sprite pipeline. Spare voices are only constructed;
  // a spoken line initializes its player when it is needed.
  const newPlayer = (name: string): Promise<Player | null> => {
    const player = makePlayer(name);
    if (!player) return Promise.resolve(null);
    return player.initialize().then(
      () => player,
      (error: unknown) => {
        report(`sound: ${name} player not initialised: ${String(error)}`);
        return null;
      },
    );
  };

  const pause = (name: string, player: Player | null | undefined) => {
    if (!player) return;
    try {
      player.pause();
    } catch (error) {
      report(`sound: ${name} did not stop: ${String(error)}`);
    }
  };

  // Silence before releasing, without pause(): a clip may already have ended,
  // and pause followed by deinitialize stalls GStreamer on the Stick (#374).
  const letGo = async (name: string, player: Player) => {
    try {
      player.volume = 0;
    } catch (error) {
      report(`sound: ${name} volume not set: ${String(error)}`);
    }
    try {
      await player.deinitialize();
    } catch (error) {
      report(`sound: ${name} player not released: ${String(error)}`);
    }
  };

  const choose = (files: readonly string[]) =>
    files[Math.min(files.length - 1, Math.max(0, pick(files.length)))];

  // The take each channel's player waits at, paused at the start of its clip.
  // A channel has none while a clip plays, or when the wait could not be set.
  const parked = new Map<Channel, string>();
  const park = (channel: Channel, player: Player) => {
    const file = choose(CUE_FILES[MAIN_CUE[channel]]);
    const clip = EFFECT_CLIPS[file];
    if (!clip) return;
    try {
      player.currentTime = Math.max(0, clip.start - CLIP_LEAD_SECONDS);
      parked.set(channel, file);
    } catch (error) {
      report(
        `sound: ${channel} did not wait at its next clip: ${String(error)}`,
      );
    }
  };

  // Counts what was started on each channel, a cue or the first moment of
  // silence: the clip a pause belongs to.
  const started = new Map<Channel, number>();
  const take = (channel: Channel) => {
    const turn = (started.get(channel) ?? 0) + 1;
    started.set(channel, turn);
    return turn;
  };
  // Once a clip is over, unless something newer is on the channel, its player
  // is paused and waits at the next take.
  const rest = (channel: Channel, player: Player, turn: number) => {
    if (started.get(channel) !== turn) return;
    pause(channel, player);
    try {
      loud(player);
    } catch (error) {
      report(`sound: ${channel} volume not set: ${String(error)}`);
    }
    park(channel, player);
  };
  // Players kept at volume zero while they play the silence the sprite opens
  // with.
  const quiet = new Set<Player>();
  // A channel plays its first silence once, as soon as it can be heard: one
  // that came up while sound was off or the app was away waits until then.
  // One that failed to start is tried again the next time sound comes on.
  const primed = new Set<Channel>();
  const priming = new Set<Channel>();
  const prime = (channel: Channel, player: Player) => {
    if (muted || suspended || primed.has(channel) || priming.has(channel))
      return;
    priming.add(channel);
    const turn = take(channel);
    const held = lease;
    try {
      player.volume = 0;
      quiet.add(player);
    } catch (error) {
      priming.delete(channel);
      report(`sound: ${channel} volume not set: ${String(error)}`);
      return;
    }
    player.play().then(
      () => {
        // Let go meanwhile: the channel's next player primes for itself.
        if (held !== lease) return;
        priming.delete(channel);
        primed.add(channel);
        endClip(() => rest(channel, player, turn), CLIP_TAIL_MS);
      },
      (error: unknown) => {
        if (held !== lease) return;
        priming.delete(channel);
        report(`sound: ${channel} did not start: ${String(error)}`);
      },
    );
  };
  const loud = (player: Player) => {
    if (quiet.delete(player) || player.volume !== soundGain) {
      player.volume = soundGain;
    }
  };

  // Each channel's player, given the sprite once and made before it is needed,
  // so the first cue of a game is not the one that waits for a media pipeline
  // to come up. `ready` holds the ones done, so that leaving lets them go at
  // once rather than a turn of the event loop later, when focus may already be
  // back, or the system has stopped the JavaScript thread.
  const ready = new Map<Channel, Player>();
  const channels = new Map<Channel, Promise<Player | null>>();
  const load = (channel: Channel, held: number) =>
    newPlayer(channel).then((player) => {
      if (!player) return null;
      // Let go while it was still initializing: it never joins the channels.
      if (held !== lease) {
        void letGo(channel, player);
        return null;
      }
      try {
        player.src = `${ROOT}/${EFFECT_SPRITE}`;
      } catch (error) {
        report(`sound: ${channel} player not loaded: ${String(error)}`);
        void letGo(channel, player);
        return null;
      }
      ready.set(channel, player);
      prime(channel, player);
      return player;
    });
  let cancelWake: (() => void) | null = null;
  const acquire = () => {
    cancelWake?.();
    cancelWake = null;
    if (disposed || suspended || channels.size) return;
    for (const channel of CHANNELS) channels.set(channel, load(channel, lease));
  };
  // Lets the channels' players go, silent at once. What they were playing, or
  // waiting at, goes with them: each channel moves on a take, so that a clip
  // of theirs ending later pauses and moves nothing. A player still
  // initializing is let go when it is ready.
  const releaseChannels = () => {
    cancelWake?.();
    cancelWake = null;
    if (!channels.size) return;
    lease++;
    const players = [...ready];
    channels.clear();
    ready.clear();
    parked.clear();
    for (const channel of CHANNELS) take(channel);
    primed.clear();
    priming.clear();
    quiet.clear();
    for (const [channel, player] of players) void letGo(channel, player);
  };
  acquire();

  const primeReady = () => {
    for (const [channel, player] of ready) prime(channel, player);
  };

  const start = async (cue: Cue, generation: number) => {
    const files = CUE_FILES[cue];
    const channel = CHANNEL[cue];
    const player = await channels.get(channel);
    // Muting can happen while a player is still initializing.
    if (!player || muted || suspended || generation !== suspension) return;
    // The player already waits at one of this cue's takes: that is the take.
    const waiting = parked.get(channel);
    const atClip = waiting !== undefined && files.includes(waiting);
    const file = atClip ? waiting : choose(files);
    parked.delete(channel);
    const clip = EFFECT_CLIPS[file];
    if (!clip) return report(`sound: ${file} is not in the sprite`);
    const turn = take(channel);
    try {
      // A cue that comes while the player still plays its first silence.
      loud(player);
      if (!atClip) {
        player.pause();
        player.currentTime = Math.max(0, clip.start - CLIP_LEAD_SECONDS);
      }
      await player.play();
      // Silenced while it was starting, and nothing newer is on the channel:
      // the pause sent then may have come before the clip began.
      if (
        (generation !== suspension || muted || suspended) &&
        started.get(channel) === turn
      )
        player.pause();
    } catch (error) {
      report(`sound: ${cue} did not play: ${String(error)}`);
      return;
    }
    endClip(
      () => rest(channel, player, turn),
      Math.round((clip.seconds + CLIP_LEAD_SECONDS) * 1000) + CLIP_TAIL_MS,
    );
  };

  // Muting pauses the players and keeps them. A player still initializing
  // when the stop was asked for has nothing playing, and start() checks again
  // before it plays.
  const stopEffects = () => {
    if (!muted) return;
    for (const channel of CHANNELS) pause(channel, ready.get(channel));
  };

  // Constructed spares, oldest first. Initialize when a line is requested.
  const spares: (Player | null)[] = Array.from({ length: SPARE_PLAYERS }, () =>
    makePlayer('spare'),
  );
  const fresh = (): Player | null => {
    spares.push(makePlayer('spare'));
    return spares.shift()!;
  };

  // The player the last line was said on.
  let voice: Player | null = null;
  let detachLine: () => void = () => undefined;
  const silentVoice = () => disposed || suspended || !voices;
  // A line's player is let go once the line is over, however it ended, unless
  // a newer line has let it go already. A loaded player kept paused still costs
  // the Stick (#374).
  const release = (player: Player) => {
    if (voice !== player) return;
    voice = null;
    detachLine();
    detachLine = () => undefined;
    speech(false);
    void letGo('voice', player);
  };

  // The line on the player is cut short whatever the settings say, and one
  // waiting to start is dropped: for a line replaced by another, or stopped.
  const cut = () => {
    const turn = ++lines;
    if (voice) release(voice);
    speech(false);
    return turn;
  };

  // A line stopped before its end: whatever was waiting to start is dropped.
  const hush = () => {
    cut();
  };

  const speak = async (
    id: string,
    turn: number,
    ms: number,
    onEnded?: () => void,
  ) => {
    const clip = VOICE_FILES[id];
    if (!clip || turn !== lines || silentVoice()) return;
    const player = fresh();
    if (!player) return;
    voice = player;
    const current = () => voice === player && turn === lines;
    const finish = () => {
      if (current()) release(player);
    };
    let ending = false;
    const ended = () => {
      if (!current() || ending) return;
      ending = true;
      later(() => {
        if (!current()) return;
        finish();
        try {
          onEnded?.();
        } catch (error) {
          report(
            `sound: line ${id} completion callback failed: ${String(error)}`,
          );
        }
      }, LINE_TAIL_MS);
    };
    const failed = () => {
      if (!current()) return;
      report(`sound: line ${id} playback failed`);
      finish();
    };
    const started = () => {
      if (current() && !ending) speech(true);
    };
    let requested = false;
    const canPlay = () => {
      if (!current() || requested) return;
      try {
        if (!Number.isFinite(player.duration) || player.duration <= 0) return;
        requested = true;
        void player.play().catch(failed);
      } catch {
        failed();
      }
    };
    detachLine = () => {
      for (const [event, handler] of [
        ['ended', ended],
        ['error', failed],
        ['playing', started],
        ['canplay', canPlay],
      ] as const) {
        try {
          player.removeEventListener(event, handler);
        } catch (error) {
          report(`sound: line ${id} listener not removed: ${String(error)}`);
        }
      }
    };
    // Bound missing initialization and playback events as well as a decoder
    // that never reports its end. Normal completion always follows ended.
    later(() => {
      if (!current()) return;
      report(`sound: line ${id} completion timed out`);
      finish();
    }, ms + LINE_TIMEOUT_MS);
    try {
      player.addEventListener('ended', ended);
      player.addEventListener('error', failed);
      player.addEventListener('playing', started);
      player.addEventListener('canplay', canPlay);
      await player.initialize();
      if (!current() || silentVoice()) return;
      if (voiceGain !== 1) {
        try {
          player.volume = voiceGain;
        } catch (error) {
          report(`sound: line ${id} volume not set: ${String(error)}`);
        }
      }
      // Initialize first, then load once and wait for metadata. Starting
      // alongside the load can leave a pipeline with no completion event.
      player.src = `${VOICES}/${clip.file}`;
    } catch (error) {
      if (!current()) return;
      report(`sound: line ${id} did not play: ${String(error)}`);
      release(player);
      return;
    }
    // Stopped or replaced while it was starting. A line replaced by one that
    // has not reached its player yet is stopped here, or it would go on.
    if (!current() || silentVoice()) {
      release(player);
    }
  };

  return {
    play(cues) {
      const step = ++steps;
      const generation = suspension;
      if (disposed || muted || suspended) return;
      // Back from the background before the players were made again: a cue
      // makes them at once rather than wait.
      if (cues.length) acquire();
      for (const cue of cues) {
        const wait = CUE_DELAY_MS[cue];
        if (!wait) {
          void start(cue, generation);
          continue;
        }
        // Dropped if another step comes first. start() checks muting again, so
        // a cue muted while it waits is not heard either.
        later(() => {
          if (step === steps) void start(cue, generation);
        }, wait);
      }
    },
    setMuted(value) {
      muted = value;
      stopEffects();
      primeReady();
    },
    setSoundVolume(gain) {
      soundGain = Math.max(0, Math.min(1, gain));
      for (const player of ready.values()) {
        if (!quiet.has(player)) {
          try {
            player.volume = soundGain;
          } catch (error) {
            report(`sound: player volume not set: ${String(error)}`);
          }
        }
      }
    },
    say(line, onEnded) {
      const timing = speechTiming(line);
      // The line on the player now is cut short, whether or not this one can
      // be said.
      const turn = cut();
      if (!timing) return report(`sound: line ${line.id} has no clip`);
      if (silentVoice()) return;
      if (!timing.delayMs) return void speak(line.id, turn, timing.ms, onEnded);
      later(
        () => void speak(line.id, turn, timing.ms, onEnded),
        timing.delayMs,
      );
    },
    stopLine() {
      cut();
    },
    setVoices(on) {
      voices = on;
      if (!on) hush();
    },
    setVoiceVolume(gain) {
      voiceGain = Math.max(0, Math.min(1, gain));
      if (voice) {
        try {
          voice.volume = voiceGain;
        } catch (error) {
          report(`sound: voice volume not set: ${String(error)}`);
        }
      }
    },
    setSuspended(value) {
      if (disposed) return;
      suspended = value;
      if (!value) {
        // Focus while already in front: the players are there.
        if (channels.size) return primeReady();
        cancelWake ??= wake(acquire, EFFECTS_RETURN_MS);
        return;
      }
      // A cue still waiting to start is dropped, as a new step would drop it.
      steps++;
      suspension++;
      releaseChannels();
      hush();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      steps++;
      suspension++;
      releaseChannels();
      hush();
      // Constructed spares never opened a pipeline: there is nothing to release.
      spares.length = 0;
    },
  };
}

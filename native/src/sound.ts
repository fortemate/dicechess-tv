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
// A seek takes the media pipeline a moment, and one asked for just before
// play() was heard to lose the start of a clip on the virtual device, now and
// then the whole clip. So between clips each channel's player waits, paused, at
// the start of a take of the cue it plays most, chosen in advance: that cue
// then only has to play. Any other cue seeks first.
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
// Fresh players kept ready for the next line.
export const SPARE_PLAYERS = 1;

// A win or a loss is said after its jingle, which lasts about a second, rather
// than over it, and so is the host's result. Every other line is said as it
// happens.
export const RESULT_LINE_DELAY_MS = 1200;
// The events said after the jingle. The host's White or Black win may be one
// of her lines that name no colour, whose event is 'win': it waits too.
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
  // Says a bot's or the host's line in its voice, replacing any line still
  // being said.
  say(line: SpokenLine): void;
  // Stops the line being said, or waiting to be said, as a new line would, for
  // a speaker who leaves mid-line: the Hot Seat host turned off (#202).
  stopLine(): void;
  // The Voices setting, for every spoken line, the host's included. Off,
  // nothing is said, and a line being said stops.
  setVoices(on: boolean): void;
  // While the app is away from the foreground or out of focus nothing plays,
  // anything playing stops, and a cue or line still waiting is dropped rather
  // than heard on the way back. The player's own sound setting is left alone.
  setSuspended(suspended: boolean): void;
};

export type SoundOptions = {
  // Which of several takes to play. Injected so a test can know.
  pick?: (count: number) => number;
  // Where failures go, since they are never thrown.
  report?: (line: string) => void;
  // Start muted, when the viewer turned sound off in an earlier session.
  muted?: boolean;
  // Runs a delayed cue after `wait` milliseconds. Injected so a test need not
  // wait.
  later?: (run: () => void, wait: number) => void;
  // Start with the bots' voices off, when the viewer turned them off earlier.
  voices?: boolean;
  // Pauses a cue's clip after `wait` milliseconds, once it is over. Injected so
  // a test can hold it.
  endClip?: (run: () => void, wait: number) => void;
  // Told true when a line starts to be heard and false when it has been said or
  // stopped, so the music can duck under it.
  onSpeech?: (speaking: boolean) => void;
};

type Player = Pick<
  AudioPlayer,
  'initialize' | 'deinitialize' | 'play' | 'pause' | 'src' | 'currentTime'
>;

export function createSounds({
  pick = (count) => Math.floor(Math.random() * count),
  report = () => undefined,
  muted: startMuted = false,
  later = (run, wait) => {
    setTimeout(run, wait);
  },
  voices: startVoices = true,
  onSpeech = () => undefined,
  endClip = (run, wait) => {
    setTimeout(run, wait);
  },
}: SoundOptions = {}): Sounds {
  let muted = startMuted;
  let voices = startVoices;
  let suspended = false;
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
  let speaking = false;
  const speech = (on: boolean) => {
    if (speaking === on) return;
    speaking = on;
    onSpeech(on);
  };

  // A player made and initialised, or null when the media stack refuses one.
  const newPlayer = (name: string): Promise<Player | null> => {
    let player: Player;
    try {
      player = new AudioPlayer(
        AudioContentType.CONTENT_TYPE_SONIFICATION,
        AudioUsageType.USAGE_GAME,
      );
    } catch (error) {
      report(`sound: ${name} player not created: ${String(error)}`);
      return Promise.resolve(null);
    }
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

  // A player done with is stopped and let go, in the background.
  const letGo = (name: string, player: Player) => {
    pause(name, player);
    player
      .deinitialize()
      .catch((error: unknown) =>
        report(`sound: ${name} player not released: ${String(error)}`),
      );
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

  // Each channel's player, made up front and given the sprite once, so the
  // first cue of a game is not the one that waits for a media pipeline to come
  // up. `ready` holds the ones done, so that leaving pauses them at once rather
  // than a turn of the event loop later, when focus may already be back.
  const ready = new Map<Channel, Player>();
  const channels = new Map<Channel, Promise<Player | null>>(
    CHANNELS.map((channel) => [
      channel,
      newPlayer(channel).then((player) => {
        if (!player) return null;
        try {
          player.src = `${ROOT}/${EFFECT_SPRITE}`;
        } catch (error) {
          report(`sound: ${channel} player not loaded: ${String(error)}`);
          return null;
        }
        ready.set(channel, player);
        park(channel, player);
        return player;
      }),
    ]),
  );
  // Counts the cues started on each channel: the clip a pause belongs to.
  const started = new Map<Channel, number>();

  const start = async (cue: Cue, generation: number) => {
    const files = CUE_FILES[cue];
    const channel = CHANNEL[cue];
    const player = await channels.get(channel);
    // Muting can happen while a player is still initialising.
    if (!player || muted || suspended || generation !== suspension) return;
    // The player already waits at one of this cue's takes: that is the take.
    const waiting = parked.get(channel);
    const atClip = waiting !== undefined && files.includes(waiting);
    const file = atClip ? waiting : choose(files);
    parked.delete(channel);
    const clip = EFFECT_CLIPS[file];
    if (!clip) return report(`sound: ${file} is not in the sprite`);
    const turn = (started.get(channel) ?? 0) + 1;
    started.set(channel, turn);
    try {
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
      () => {
        if (started.get(channel) !== turn) return;
        pause(channel, player);
        park(channel, player);
      },
      Math.round((clip.seconds + CLIP_LEAD_SECONDS) * 1000) + CLIP_TAIL_MS,
    );
  };

  // A player still initialising when the stop was asked for has nothing
  // playing, and start() checks again before it plays.
  const stopEffects = () => {
    if (!muted && !suspended) return;
    for (const channel of CHANNELS) pause(channel, ready.get(channel));
  };

  // The fresh players for the lines, oldest first. Each one taken is replaced
  // at once.
  const spares: Promise<Player | null>[] = Array.from(
    { length: SPARE_PLAYERS },
    () => newPlayer('spare'),
  );
  const fresh = (): Promise<Player | null> => {
    spares.push(newPlayer('spare'));
    return spares.shift()!;
  };

  // The player the last line was said on.
  let voice: Player | null = null;
  const silentVoice = () => suspended || !voices;
  // A line's player is let go once the line is over, however it ended, unless
  // a newer line has let it go already. A loaded player kept paused still costs
  // the Stick (#374).
  const release = (player: Player) => {
    if (voice !== player) return;
    voice = null;
    letGo('voice', player);
  };

  // The line on the player is cut short whatever the settings say, and one
  // waiting to start is dropped: for a line replaced by another, or stopped.
  const cut = () => {
    const turn = ++lines;
    if (speaking) pause('voice', voice);
    speech(false);
    return turn;
  };

  // A line stopped before its end: whatever was waiting to start is dropped.
  const hush = () => {
    lines++;
    if (silentVoice()) pause('voice', voice);
    speech(false);
  };

  const speak = async (id: string, turn: number, ms: number) => {
    const clip = VOICE_FILES[id];
    if (!clip) return;
    const player = await fresh();
    if (!player) return;
    if (turn !== lines || silentVoice()) return letGo('voice', player);
    const last = voice;
    voice = player;
    if (last) letGo('voice', last);
    try {
      player.src = `${VOICES}/${clip.file}`;
      await player.play();
    } catch (error) {
      report(`sound: line ${id} did not play: ${String(error)}`);
      release(player);
      return;
    }
    // Stopped or replaced while it was starting. A line replaced by one that
    // has not reached its player yet is stopped here, or it would go on.
    if (turn !== lines || silentVoice()) {
      release(player);
      return;
    }
    speech(true);
    later(() => {
      if (turn === lines) speech(false);
      // Said, or stopped on the way: its player is let go.
      release(player);
    }, ms);
  };

  return {
    play(cues) {
      const step = ++steps;
      const generation = suspension;
      if (muted || suspended) return;
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
    },
    say(line) {
      const timing = speechTiming(line);
      // The line on the player now is cut short, whether or not this one can
      // be said.
      const turn = cut();
      if (!timing) return report(`sound: line ${line.id} has no clip`);
      if (silentVoice()) return;
      if (!timing.delayMs) return void speak(line.id, turn, timing.ms);
      later(() => void speak(line.id, turn, timing.ms), timing.delayMs);
    },
    stopLine() {
      cut();
    },
    setVoices(on) {
      voices = on;
      if (!on) hush();
    },
    setSuspended(value) {
      suspended = value;
      if (!value) return;
      // A cue still waiting to start is dropped, as a new step would drop it.
      steps++;
      suspension++;
      stopEffects();
      hush();
    },
  };
}

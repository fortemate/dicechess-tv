// Plays the game's cues on Vega.
//
// The route was measured on the virtual device before this was written — see
// "Sound" in native/README.md. An AudioPlayer constructed as SONIFICATION/GAME,
// a plain path rather than a URL, and a replay that pauses and rewinds first,
// because calling play() again on a finished clip was heard to do nothing.
//
// A player is given its clip once and never another (#374). On a Fire TV Stick
// with OS build 2602000051520, setting `src` on a player that has already
// played took about 100 ms, and now and then never returned: the JavaScript
// thread waited inside the media player until the system closed the app as not
// responding. On a fresh player it took about 10 ms, and a rewind takes 1 ms.
//
// So each sound file has a player of its own, made up front. The cues still go
// out on three channels: a capture and the win it causes are heard together,
// because they are on different channels; a new move on the same channel cuts
// the last one short instead of piling sounds up.
//
// The lines are spoken on a fresh player each: the bots' (#159), the Hot Seat
// host's (#202), and Thinkle's as he teaches the tutorial (#264). The next one
// is made while a line is said, so a line does not wait for a player, and the
// last one is let go. The voices have a setting of their own, so turning the
// effects off leaves the voices, and the other way round; a new line replaces
// the one being said, and neither cuts nor is cut by a cue. The app is told
// when a line starts and ends, so the music can duck under it.
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
// Every file a cue can play, each once: the effects' players.
const EFFECT_FILES: readonly string[] = [
  ...new Set(Object.values(CUE_FILES).flat()),
];

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
  // The suspension each channel was last started in.
  const onEffects = new Map<Channel, number>();
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

  // The effects' players are made up front, so the first cue of a game is not
  // the one that waits for a media pipeline to come up.
  const effects = new Map<string, Promise<Player | null>>(
    EFFECT_FILES.map((file) => [file, newPlayer(file)]),
  );
  // The players already given their clip.
  const given = new Set<Player>();
  // The player last started on each channel: the one a new cue there cuts
  // short, and the one leaving or muting stops at once.
  const onChannel = new Map<Channel, Player>();

  const start = async (cue: Cue, generation: number) => {
    const files = CUE_FILES[cue];
    const file =
      files[Math.min(files.length - 1, Math.max(0, pick(files.length)))];
    const channel = CHANNEL[cue];
    const player = await effects.get(file);
    // Muting can happen while a player is still initialising.
    if (!player || muted || suspended || generation !== suspension) return;
    try {
      const last = onChannel.get(channel);
      onChannel.set(channel, player);
      if (last !== player) pause(channel, last);
      if (given.has(player)) {
        player.pause();
        player.currentTime = 0;
      } else {
        player.src = `${ROOT}/${file}`;
        given.add(player);
      }
      onEffects.set(channel, generation);
      await player.play();
      // Silenced while it was starting, and nothing newer is on the channel:
      // the pause sent then may have come before the clip began.
      if (
        (generation !== suspension || muted || suspended) &&
        onEffects.get(channel) === generation
      )
        player.pause();
    } catch (error) {
      report(`sound: ${cue} did not play: ${String(error)}`);
    }
  };

  // A player still initialising when the stop was asked for has nothing
  // playing, and start() checks again before it plays.
  const stopEffects = () => {
    if (!muted && !suspended) return;
    for (const channel of CHANNELS) pause(channel, onChannel.get(channel));
  };

  // The player made for the next line, and the one the last line was said on.
  let nextVoice = newPlayer('voice');
  let voice: Player | null = null;
  // A player done with is let go, in the background.
  const release = (player: Player) => {
    player
      .deinitialize()
      .catch((error: unknown) =>
        report(`sound: voice player not released: ${String(error)}`),
      );
  };
  const silentVoice = () => suspended || !voices;

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
    const ready = nextVoice;
    nextVoice = newPlayer('voice');
    const player = await ready;
    if (!player) return;
    if (turn !== lines || silentVoice()) return release(player);
    const last = voice;
    voice = player;
    if (last) release(last);
    try {
      player.src = `${VOICES}/${clip.file}`;
      await player.play();
    } catch (error) {
      report(`sound: line ${id} did not play: ${String(error)}`);
      return;
    }
    // Stopped or replaced while it was starting. A line replaced by one that
    // has not reached its player yet is stopped here, or it would go on.
    if (turn !== lines || silentVoice()) {
      if (voice === player) pause('voice', player);
      return;
    }
    speech(true);
    later(() => {
      if (turn === lines) speech(false);
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

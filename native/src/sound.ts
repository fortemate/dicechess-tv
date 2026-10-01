// Plays the game's cues on Vega.
//
// The route was measured on the virtual device before this was written — see
// "Sound" in native/README.md. An AudioPlayer constructed as SONIFICATION/GAME,
// a plain path rather than a URL, and a replay that pauses and rewinds first,
// because calling play() again on a finished clip was heard to do nothing.
//
// Three players, one per channel. A capture and the win it causes are heard
// together, because they are on different channels; a new move on the same
// channel cuts the last one short instead of piling sounds up.
//
// A fourth player speaks the bots' lines (#159). It has a setting of its own,
// so turning the effects off leaves the voices, and the other way round; a new
// line replaces the one being said, and neither cuts nor is cut by a cue. The
// app is told when a line starts and ends, so the music can duck under it.
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
import { CUE_FILES } from './cueFiles';
import { VOICE_FILES } from './voiceFiles';

// Where the build copies the vendored files: `assets/` in the package is `/pkg/`
// at run time. A file:// URL for the same file fails; the bare path plays.
const ROOT = '/pkg/assets/sfx';
const VOICES = '/pkg/assets/voices';

type Channel = 'board' | 'dice' | 'result';
// The cue channels, and the voice.
type Slot = Channel | 'voice';

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
const PLAYERS: readonly Slot[] = [...CHANNELS, 'voice'];

// A win or a loss is said after its jingle, which lasts about a second, rather
// than over it. Every other line is said as it happens.
export const RESULT_LINE_DELAY_MS = 1200;
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
  line: Pick<VoiceLine, 'id' | 'event'>,
): { delayMs: number; ms: number } | null => {
  const clip = VOICE_FILES[line.id];
  if (!clip) return null;
  const delayMs =
    line.event === 'win' || line.event === 'loss' ? RESULT_LINE_DELAY_MS : 0;
  return { delayMs, ms: Math.round(clip.seconds * 1000) + LINE_TAIL_MS };
};

export type Sounds = {
  // Called on every step of the game, even a silent one: a cue still waiting
  // to start is dropped once the game has moved on.
  play(cues: readonly Cue[]): void;
  setMuted(muted: boolean): void;
  // Says a bot's line in its voice, replacing any line still being said.
  say(line: Pick<VoiceLine, 'id' | 'event'>): void;
  // The Bot voices setting. Off, nothing is said, and a line being said stops.
  setVoices(on: boolean): void;
  // While the app is away from the foreground nothing plays, and anything
  // playing stops. The player's own sound setting is left alone.
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
  'initialize' | 'play' | 'pause' | 'src' | 'currentTime'
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
  // Counts the steps play() has been told about. A delayed cue starts only if
  // no step came after its own, so a resignation's jingle on the result player
  // is not cut short by the empty roll just before it.
  let steps = 0;
  const loaded = new Map<Slot, string>();
  // Counts the lines asked for. A line waiting or being said is still the
  // current one only while no other came after it, and nothing stopped it.
  let lines = 0;
  let speaking = false;
  const speech = (on: boolean) => {
    if (speaking === on) return;
    speaking = on;
    onSpeech(on);
  };

  // Players are created and initialised up front, so the first cue of a game is
  // not the one that waits for a media pipeline to come up.
  const players = new Map<Slot, Promise<Player | null>>(
    PLAYERS.map((channel) => {
      let player: Player;
      try {
        player = new AudioPlayer(
          AudioContentType.CONTENT_TYPE_SONIFICATION,
          AudioUsageType.USAGE_GAME,
        );
      } catch (error) {
        report(`sound: ${channel} player not created: ${String(error)}`);
        return [channel, Promise.resolve(null)];
      }
      return [
        channel,
        player.initialize().then(
          () => player,
          (error: unknown) => {
            report(
              `sound: ${channel} player not initialised: ${String(error)}`,
            );
            return null;
          },
        ),
      ];
    }),
  );

  const start = async (cue: Cue) => {
    const files = CUE_FILES[cue];
    const file =
      files[Math.min(files.length - 1, Math.max(0, pick(files.length)))];
    const channel = CHANNEL[cue];
    const player = await players.get(channel);
    // Muting can happen while a player is still initialising.
    if (!player || muted || suspended) return;
    try {
      const src = `${ROOT}/${file}`;
      if (loaded.get(channel) === src) {
        player.pause();
        player.currentTime = 0;
      } else {
        player.src = src;
        loaded.set(channel, src);
      }
      await player.play();
    } catch (error) {
      report(`sound: ${cue} did not play: ${String(error)}`);
    }
  };

  // Whether a player should be silent now.
  const silent = (channel: Slot) =>
    suspended || (channel === 'voice' ? !voices : muted);

  const stop = (channels: readonly Slot[]) => {
    for (const channel of channels)
      void players.get(channel)?.then((player) => {
        // A player still initialising when the stop was asked for had nothing
        // playing. If sound is back on by the time it is ready, a cue started
        // since then is left to play.
        if (!player || !silent(channel)) return;
        try {
          player.pause();
        } catch (error) {
          report(`sound: ${channel} did not stop: ${String(error)}`);
        }
      });
  };

  // The line the voice player was last started on.
  let onPlayer = 0;
  const pauseVoice = (player: Player) => {
    try {
      player.pause();
    } catch (error) {
      report(`sound: voice did not stop: ${String(error)}`);
    }
  };
  // Pauses the voice whatever the settings say, for a line replaced by another.
  const interrupt = () => {
    if (!speaking) return;
    void players.get('voice')?.then((player) => {
      if (player) pauseVoice(player);
    });
  };

  // A line stopped before its end: whatever was waiting to start is dropped.
  const hush = () => {
    lines++;
    stop(['voice']);
    speech(false);
  };

  const speak = async (id: string, turn: number, ms: number) => {
    const clip = VOICE_FILES[id];
    const player = await players.get('voice');
    if (!player || !clip || turn !== lines || silent('voice')) return;
    try {
      const src = `${VOICES}/${clip.file}`;
      if (loaded.get('voice') === src) {
        player.pause();
        player.currentTime = 0;
      } else {
        player.src = src;
        loaded.set('voice', src);
      }
      onPlayer = turn;
      await player.play();
    } catch (error) {
      report(`sound: line ${id} did not play: ${String(error)}`);
      return;
    }
    // Stopped or replaced while it was starting. A line replaced by one that
    // has not reached the player yet is stopped here, or it would go on.
    if (turn !== lines || silent('voice')) {
      if (onPlayer === turn) pauseVoice(player);
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
      if (muted || suspended) return;
      for (const cue of cues) {
        const wait = CUE_DELAY_MS[cue];
        if (!wait) {
          void start(cue);
          continue;
        }
        // Dropped if another step comes first. start() checks muting again, so
        // a cue muted while it waits is not heard either.
        later(() => {
          if (step === steps) void start(cue);
        }, wait);
      }
    },
    setMuted(value) {
      muted = value;
      if (value) stop(CHANNELS);
    },
    say(line) {
      const timing = speechTiming(line);
      // The line on the player now is cut short, whether or not this one can
      // be said.
      const turn = ++lines;
      interrupt();
      speech(false);
      if (!timing) return report(`sound: line ${line.id} has no clip`);
      if (silent('voice')) return;
      if (!timing.delayMs) return void speak(line.id, turn, timing.ms);
      later(() => void speak(line.id, turn, timing.ms), timing.delayMs);
    },
    setVoices(on) {
      voices = on;
      if (!on) hush();
    },
    setSuspended(value) {
      suspended = value;
      if (!value) return;
      stop(CHANNELS);
      hush();
    },
  };
}

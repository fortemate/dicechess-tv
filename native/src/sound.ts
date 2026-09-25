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
// Nothing in here may break the game. Every failure is reported and swallowed:
// a game that plays silently is a bug, a game that stops is a worse one.
import {
  AudioPlayer,
  AudioContentType,
  AudioUsageType,
} from '@amazon-devices/react-native-w3cmedia';
import type { Cue } from '../../src/core/cues';
import { CUE_FILES } from './cueFiles';

// Where the build copies the vendored files: `assets/` in the package is `/pkg/`
// at run time. A file:// URL for the same file fails; the bare path plays.
const ROOT = '/pkg/assets/sfx';

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
const DELAY: Partial<Record<Cue, number>> = { no_move: 500 };

const CHANNELS: readonly Channel[] = ['board', 'dice', 'result'];

export type Sounds = {
  // Called on every step of the game, even a silent one: a cue still waiting
  // to start is dropped once the game has moved on.
  play(cues: readonly Cue[]): void;
  setMuted(muted: boolean): void;
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
}: SoundOptions = {}): Sounds {
  let muted = startMuted;
  let suspended = false;
  // Counts the steps play() has been told about. A delayed cue starts only if
  // no step came after its own, so a resignation's jingle on the result player
  // is not cut short by the empty roll just before it.
  let steps = 0;
  const loaded = new Map<Channel, string>();

  // Players are created and initialised up front, so the first cue of a game is
  // not the one that waits for a media pipeline to come up.
  const players = new Map<Channel, Promise<Player | null>>(
    CHANNELS.map((channel) => {
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

  const stopAll = () => {
    for (const [channel, ready] of players)
      void ready.then((player) => {
        // A player still initialising when the stop was asked for had nothing
        // playing. If sound is back on by the time it is ready, a cue started
        // since then is left to play.
        if (!player || (!muted && !suspended)) return;
        try {
          player.pause();
        } catch (error) {
          report(`sound: ${channel} did not stop: ${String(error)}`);
        }
      });
  };

  return {
    play(cues) {
      const step = ++steps;
      if (muted || suspended) return;
      for (const cue of cues) {
        const wait = DELAY[cue];
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
      if (value) stopAll();
    },
    setSuspended(value) {
      suspended = value;
      if (value) stopAll();
    },
  };
}

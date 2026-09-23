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
  game_win: 'result',
  game_loss: 'result',
  game_draw: 'result',
};

const CHANNELS: readonly Channel[] = ['board', 'dice', 'result'];

export type Sounds = {
  play(cues: readonly Cue[]): void;
  setMuted(muted: boolean): void;
};

export type SoundOptions = {
  // Which of several takes to play. Injected so a test can know.
  pick?: (count: number) => number;
  // Where failures go, since they are never thrown.
  report?: (line: string) => void;
  // Start muted, when the viewer turned sound off in an earlier session.
  muted?: boolean;
};

type Player = Pick<
  AudioPlayer,
  'initialize' | 'play' | 'pause' | 'src' | 'currentTime'
>;

export function createSounds({
  pick = (count) => Math.floor(Math.random() * count),
  report = () => undefined,
  muted: startMuted = false,
}: SoundOptions = {}): Sounds {
  let muted = startMuted;
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
    if (!player || muted) return;
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

  return {
    play(cues) {
      if (muted) return;
      for (const cue of cues) void start(cue);
    },
    setMuted(value) {
      muted = value;
      if (!value) return;
      for (const ready of players.values())
        void ready.then((player) => {
          try {
            player?.pause();
          } catch {
            // Silence is what was asked for either way.
          }
        });
    },
  };
}

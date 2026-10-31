import {
  DEFAULT_SOUND,
  soundHeard,
  soundGain,
  type SoundSetting,
} from '../../native/src/soundSetting.ts';
import type { Cue } from '../../src/core/cues';
import type { Sounds } from '../../native/src/audio';
import type { Activity } from '../../native/src/activity';

type Status = { playing: boolean; didJustFinish: boolean; currentTime: number };
export type EffectPlayer = {
  volume: number;
  play(): void;
  pause(): void;
  remove(): void;
  addListener(
    event: 'playbackStatusUpdate',
    listener: (status: Status) => void,
  ): { remove(): void };
};
export type EffectBackend = {
  configure(): Promise<void>;
  create(cue: Cue, gain: number): EffectPlayer;
  report(event: string, detail: unknown): void;
};
type Channel = 'board' | 'dice' | 'result';

// Optional audio must never turn a valid game into a load failure.
export function openOptionalEffects(
  open: () => ReturnType<typeof createEffects>,
  report: (error: unknown) => void,
): ReturnType<typeof createEffects> | null {
  try {
    return open();
  } catch (error) {
    report(error);
    return null;
  }
}

const channels: Record<Cue, Channel> = {
  piece_move: 'board',
  piece_capture: 'board',
  castle: 'board',
  promotion: 'board',
  dice_roll: 'dice',
  turn_handoff: 'dice',
  no_move: 'result',
  game_win: 'result',
  game_loss: 'result',
  game_draw: 'result',
};

// Effects-only subset of the shared contract. No music or speech implementation.
// Each channel owns at most one player; completion, suspension and unmount release it.
export function createEffects(
  activity: Activity,
  backend: EffectBackend,
  schedule = (run: () => void, ms: number) => {
    const timer = setTimeout(run, ms);
    return () => clearTimeout(timer);
  },
  sound: SoundSetting = DEFAULT_SOUND,
): Pick<Sounds, 'play' | 'setSuspended' | 'dispose'> & {
  setSound(setting: SoundSetting): void;
} {
  let disposed = false;
  let suspended = !activity.isActive();
  let ready = false;
  let step = 0;
  const players = new Map<Channel, () => void>();
  const gains = new Map<Channel, (gain: number) => void>();
  const pending = new Set<() => void>();
  const reportError = (error: unknown) =>
    backend.report('error', String(error));
  const attempt = (run: () => void) => {
    try {
      run();
    } catch (error) {
      reportError(error);
    }
  };
  const cancelPending = () => {
    step++;
    pending.forEach((cancel) => cancel());
    pending.clear();
  };
  const stop = () => {
    cancelPending();
    [...players.values()].forEach((release) => release());
  };
  const allowed = () =>
    !disposed &&
    !suspended &&
    activity.isActive() &&
    ready &&
    soundHeard(sound);
  const setSuspended = (value: boolean) => {
    if (disposed || suspended === value) return;
    suspended = value;
    if (value) stop();
    backend.report('suspended', value);
  };
  const unsubscribe = activity.subscribe(() =>
    setSuspended(!activity.isActive()),
  );
  // Configuration is asynchronous; early effects are dropped, never replayed.
  void backend
    .configure()
    .then(() => {
      if (!disposed) {
        ready = true;
        backend.report('ready', null);
      }
    })
    .catch(reportError);

  const start = (cue: Cue) => {
    if (!allowed()) return;
    const channel = channels[cue];
    players.get(channel)?.();
    let player: EffectPlayer;
    try {
      player = backend.create(cue, soundGain(sound.volume));
    } catch (error) {
      reportError(error);
      return;
    }
    let released = false;
    let subscription: { remove(): void } | undefined;
    let cancelTimeout: (() => void) | undefined;
    const release = () => {
      if (released) return;
      released = true;
      players.delete(channel);
      gains.delete(channel);
      cancelTimeout?.();
      attempt(() => subscription?.remove());
      attempt(() => player.pause());
      attempt(() => player.remove());
      backend.report('released', { cue });
    };
    players.set(channel, release);
    gains.set(channel, (gain) => attempt(() => (player.volume = gain)));
    try {
      let reportedPlaying = false;
      subscription = player.addListener('playbackStatusUpdate', (status) => {
        if (released) return;
        if (status.playing && !reportedPlaying) {
          reportedPlaying = true;
          backend.report('playing', { cue, position: status.currentTime });
        }
        if (status.didJustFinish) {
          backend.report('finished', { cue, position: status.currentTime });
          release();
        }
      });
      // Also bound resource lifetime if the native decoder never completes.
      cancelTimeout = schedule(() => {
        backend.report('timeout', { cue });
        release();
      }, 10000);
      player.play();
      backend.report('requested', { cue, gain: soundGain(sound.volume) });
    } catch (error) {
      release();
      reportError(error);
    }
  };
  return {
    /** Update live gain or cancel all active and delayed effects when muted. */
    setSound(next) {
      if (disposed) return;
      sound = next;
      if (!soundHeard(sound)) stop();
      else gains.forEach((apply) => apply(soundGain(sound.volume)));
      backend.report('setting', sound);
    },
    play(cues) {
      cancelPending();
      if (!allowed()) return;
      const ticket = step;
      for (const cue of cues) {
        if (cue !== 'no_move') start(cue);
        else {
          const cancel = schedule(() => {
            pending.delete(cancel);
            if (ticket === step) start(cue);
          }, 500);
          pending.add(cancel);
        }
      }
    },
    setSuspended,
    dispose() {
      if (disposed) return;
      disposed = true;
      unsubscribe();
      stop();
      backend.report('disposed', null);
    },
  };
}

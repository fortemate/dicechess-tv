import type { Activity } from '../../native/src/activity';
import type { Sounds, SpokenLine } from '../../native/src/audio';
import { speechTiming, LINE_TAIL_MS } from '../../native/src/speechTiming';
import { VOICE_FILES } from '../../native/src/voiceFiles';
import { voiceGain, type VoiceSetting } from '../../native/src/voiceSetting';

export type SpeechStatus = {
  playing: boolean;
  didJustFinish: boolean;
  playbackState?: string;
};
export type SpeechPlayer = {
  volume: number;
  play(): void;
  pause(): void;
  remove(): void;
  addListener(
    event: 'playbackStatusUpdate',
    fn: (status: SpeechStatus) => void,
  ): { remove(): void };
};
export type SpeechBackend = {
  configure(): Promise<void>;
  create(id: string, gain: number): SpeechPlayer;
  report(event: string, detail: unknown): void;
};
export type Speech = Pick<
  Sounds,
  | 'say'
  | 'stopLine'
  | 'setVoices'
  | 'setVoiceVolume'
  | 'setSuspended'
  | 'dispose'
>;

/** Own one spoken line; only decoder completion plus the shared tail advances tutorial speech. */
export function createSpeech(
  activity: Activity,
  backend: SpeechBackend,
  initial: VoiceSetting,
  schedule = (run: () => void, ms: number) => {
    const t = setTimeout(run, ms);
    return () => clearTimeout(t);
  },
): Speech {
  let disposed = false;
  let suspended = !activity.isActive();
  let enabled = initial.on;
  let gain = voiceGain(initial.volume);
  let ready = false;
  let ticket = 0;
  let updateGain: ((value: number) => void) | undefined;
  let release: (() => void) | undefined;
  let pending: (() => void) | undefined;
  const timers = new Set<() => void>();
  const safe = (run: () => void) => {
    try {
      run();
    } catch (error) {
      backend.report('error', String(error));
    }
  };
  const allowed = () =>
    !disposed && !suspended && activity.isActive() && enabled && gain > 0;
  const later = (run: () => void, ms: number) => {
    const cancel = schedule(() => {
      timers.delete(cancel);
      run();
    }, ms);
    timers.add(cancel);
  };
  const stopLine = () => {
    ticket++;
    pending = undefined;
    timers.forEach((cancel) => cancel());
    timers.clear();
    release?.();
    release = undefined;
    updateGain = undefined;
  };
  const setSuspended = (value: boolean) => {
    if (disposed || suspended === value) return;
    suspended = value;
    if (value) stopLine();
    backend.report('suspended', value);
  };
  const unsubscribe = activity.subscribe(() =>
    setSuspended(!activity.isActive()),
  );
  let configuration: Promise<void>;
  try {
    configuration = backend.configure();
  } catch (error) {
    configuration = Promise.reject(error);
  }
  void configuration
    .then(() => {
      if (disposed) return;
      ready = true;
      backend.report('ready', null);
      const next = pending;
      pending = undefined;
      if (allowed()) next?.();
    })
    .catch((error) => {
      stopLine();
      backend.report('error', String(error));
    });
  return {
    say(line: SpokenLine, onEnded?: () => void) {
      stopLine();
      const timing = speechTiming(line);
      if (!allowed() || !timing || !VOICE_FILES[line.id]) return;
      const current = ticket;
      const valid = () => allowed() && current === ticket;
      const start = () => {
        if (!valid()) return;
        let player: SpeechPlayer;
        try {
          player = backend.create(line.id, gain);
        } catch (error) {
          backend.report('error', String(error));
          return;
        }
        let released = false;
        let ending = false;
        let subscription: { remove(): void } | undefined;
        const cleanup = () => {
          if (released) return;
          released = true;
          safe(() => subscription?.remove());
          safe(() => player.pause());
          safe(() => player.remove());
          backend.report('released', { id: line.id });
        };
        release = cleanup;
        updateGain = (value) => {
          player.volume = value;
        };
        try {
          let playing = false;
          subscription = player.addListener(
            'playbackStatusUpdate',
            (status) => {
              if (released || !valid()) return;
              if (status.playbackState === 'error') {
                backend.report('error', { id: line.id });
                stopLine();
                return;
              }
              if (status.playing && !playing) {
                playing = true;
                backend.report('playing', { id: line.id });
              }
              if (status.didJustFinish && !ending) {
                ending = true;
                backend.report('finished', { id: line.id });
                later(() => {
                  if (!valid() || released) return;
                  stopLine();
                  backend.report('completed', { id: line.id });
                  safe(() => onEnded?.());
                }, LINE_TAIL_MS);
              }
            },
          );
          later(() => {
            if (!released && valid()) {
              backend.report('timeout', { id: line.id });
              stopLine();
            }
          }, timing.ms + 15000);
          player.play();
          backend.report('requested', { id: line.id, gain });
        } catch (error) {
          stopLine();
          backend.report('error', String(error));
        }
      };
      const begin = () =>
        timing.delayMs ? later(start, timing.delayMs) : start();
      if (ready) begin();
      else pending = begin;
    },
    stopLine,
    setVoices(on) {
      enabled = on;
      if (!on) stopLine();
    },
    setVoiceVolume(value) {
      gain = value;
      safe(() => updateGain?.(value));
      if (value <= 0) stopLine();
    },
    setSuspended,
    dispose() {
      if (disposed) return;
      disposed = true;
      unsubscribe();
      stopLine();
      backend.report('disposed', null);
    },
  };
}

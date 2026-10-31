import type { MusicPlayer } from '../../native/src/musicEngine';
export type MusicStatus = {
  isLoaded: boolean;
  duration: number;
  currentTime: number;
  playing: boolean;
  didJustFinish: boolean;
  playbackState: string;
};
export type NativeMusicPlayer = {
  volume: number;
  readonly currentTime: number;
  readonly duration: number;
  play(): void;
  pause(): void;
  remove(): void;
  seekTo(seconds: number): Promise<void>;
  addListener(
    event: 'playbackStatusUpdate',
    listener: (status: MusicStatus) => void,
  ): { remove(): void };
};
export type MusicBackend = {
  configure(): Promise<void>;
  create(file: string): NativeMusicPlayer;
  report(event: string, detail: unknown): void;
};
/** Adapt one source/one player to the shared engine; released callbacks and seeks remain inert. */
export function musicPlayer(backend: MusicBackend): MusicPlayer {
  let player: NativeMusicPlayer | null = null;
  let subscription: { remove(): void } | undefined;
  let disposed = false;
  let volume = 0;
  let file = '';
  let seek = 0;
  const listeners = new Map<string, Set<() => void>>();
  const emit = (event: string) => {
    if (!disposed) [...(listeners.get(event) ?? [])].forEach((fn) => fn());
  };
  return {
    initialize: () => backend.configure(),
    async deinitialize() {
      if (disposed) return;
      disposed = true;
      listeners.clear();
      subscription?.remove();
      const owned = player;
      player = null;
      if (owned) {
        try {
          owned.volume = 0;
          owned.pause();
        } finally {
          owned.remove();
        }
      }
      backend.report('released', { file });
    },
    async play() {
      if (!disposed && player) player.play();
    },
    get src() {
      return file;
    },
    set src(value) {
      if (disposed) return;
      if (player)
        throw new Error('Music player source may only be assigned once');
      file = value;
      const owned = backend.create(value);
      player = owned;
      owned.volume = volume;
      let heard = false;
      subscription = owned.addListener('playbackStatusUpdate', (status) => {
        if (disposed || player !== owned) return;
        if (status.playbackState === 'error') {
          emit('error');
          return;
        }
        if (status.isLoaded && status.duration > 0) emit('canplay');
        if (status.playing && !heard) {
          heard = true;
          emit('playing');
          backend.report('playing', { file, position: status.currentTime });
        }
        if (status.didJustFinish) emit('ended');
      });
      backend.report('loaded', { file });
      // A cached asset may have loaded before its subscription was installed.
      if (owned.duration > 0) emit('canplay');
    },
    get duration() {
      return player?.duration ?? 0;
    },
    get currentTime() {
      return player?.currentTime ?? seek;
    },
    set currentTime(value) {
      seek = value;
      const owned = player;
      if (disposed || !owned) return;
      void owned.seekTo(value).catch(() => {
        if (player === owned) emit('error');
      });
      backend.report('seek', { file, position: value });
    },
    get volume() {
      return volume;
    },
    set volume(value) {
      volume = value;
      if (!disposed && player) {
        player.volume = value;
        backend.report('volume', { file, gain: value });
      }
    },
    addEventListener(event, listener) {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event)!.add(listener);
    },
    removeEventListener(event, listener) {
      listeners.get(event)?.delete(listener);
    },
  };
}

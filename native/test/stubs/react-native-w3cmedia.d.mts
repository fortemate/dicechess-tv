export declare const AudioContentType: { CONTENT_TYPE_SONIFICATION: number };
export declare const AudioUsageType: { USAGE_GAME: number };

/** Test-only: every call a player received, in order. */
export declare const audioLog: Array<{
  event:
    | 'create'
    | 'initialize'
    | 'src'
    | 'seek'
    | 'volume'
    | 'play'
    | 'pause'
    | 'deinitialize';
  player: number;
  src?: string;
  from?: number;
  to?: number;
  volume?: number;
  contentType?: number;
  usage?: number;
}>;
/** Test-only: forget every player, as a fresh launch would. */
export declare function resetAudio(): void;
/** Test-only: make the next players fail where a device's media stack might. */
export declare function failAudio(stage: 'initialize' | 'play' | 'pause'): void;
/** Test-only: keep the next players initialising until releaseAudio(). */
export declare function holdAudio(): void;
/** Test-only: finish initialising every held player. */
export declare function releaseAudio(): void;
/** Test-only: keep the next plays starting until releasePlays(). */
export declare function holdPlays(): void;
/** Test-only: let every held play start. */
export declare function releasePlays(): void;

export declare class AudioPlayer {
  constructor(contentType?: number, usage?: number);
  src: string;
  currentTime: number;
  volume: number;
  initialize(): Promise<void>;
  play(): Promise<void>;
  pause(): void;
  deinitialize(): Promise<void>;
}

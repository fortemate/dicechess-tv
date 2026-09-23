export declare const AudioContentType: { CONTENT_TYPE_SONIFICATION: number };
export declare const AudioUsageType: { USAGE_GAME: number };

/** Test-only: every call a player received, in order. */
export declare const audioLog: Array<{
  event: 'create' | 'initialize' | 'src' | 'play' | 'pause';
  player: number;
  src?: string;
  from?: number;
  contentType?: number;
  usage?: number;
}>;
/** Test-only: forget every player, as a fresh launch would. */
export declare function resetAudio(): void;
/** Test-only: make the next players fail where a device's media stack might. */
export declare function failAudio(stage: 'initialize' | 'play'): void;

export declare class AudioPlayer {
  constructor(contentType?: number, usage?: number);
  src: string;
  currentTime: number;
  initialize(): Promise<void>;
  play(): Promise<void>;
  pause(): void;
}

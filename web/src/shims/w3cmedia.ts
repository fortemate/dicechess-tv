// @amazon-devices/react-native-w3cmedia in the browser: the AudioPlayer that
// native/src/sound.ts drives, on an HTMLAudioElement. Its API is already the
// W3C media element's, so this only maps the device path of a vendored file to
// the URL the bench serves it at.
//
// Nothing heard here says how the television sounds: the browser's media stack
// is not Vega's.
export const AudioContentType = {
  CONTENT_TYPE_MUSIC: 2,
  CONTENT_TYPE_SONIFICATION: 4,
} as const;
export const AudioUsageType = { USAGE_GAME: 6 } as const;

// The vendored cues, which the build copies to /pkg/assets/sfx/ on a device.
const SOUNDS = import.meta.glob<string>('../../../native/sounds/*/*.mp3', {
  eager: true,
  query: '?url',
  import: 'default',
});

const DEVICE_ROOT = '/pkg/assets/sfx/';

export function urlOf(devicePath: string): string {
  if (!devicePath.startsWith(DEVICE_ROOT)) return devicePath;
  const url =
    SOUNDS[`../../../native/sounds/${devicePath.slice(DEVICE_ROOT.length)}`];
  return url ?? devicePath;
}

export class AudioPlayer {
  private readonly element = new Audio();
  private path = '';

  // Kept as the device's player keeps them; the browser has no use for them.
  constructor(
    readonly contentType?: number,
    readonly usage?: number,
  ) {
    this.element.preload = 'auto';
  }

  initialize(): Promise<void> {
    return Promise.resolve();
  }

  get src(): string {
    return this.path;
  }

  set src(path: string) {
    this.path = path;
    this.element.src = urlOf(path);
  }

  get currentTime(): number {
    return this.element.currentTime;
  }

  set currentTime(seconds: number) {
    this.element.currentTime = seconds;
  }

  get volume(): number {
    return this.element.volume;
  }

  set volume(gain: number) {
    this.element.volume = Math.max(0, Math.min(1, gain));
  }

  play(): Promise<void> {
    return this.element.play();
  }

  pause(): void {
    this.element.pause();
  }
}

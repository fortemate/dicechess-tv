// Stand-in for @amazon-devices/react-native-w3cmedia in Node. Records what a
// player was asked to do, which is all a test can know: nothing here makes sound.
export const AudioContentType = { CONTENT_TYPE_SONIFICATION: 4 };
export const AudioUsageType = { USAGE_GAME: 6 };

export const audioLog = [];

// Test-only: make the next players fail where a device's media stack might.
const failing = { initialize: false, play: false };
export function failAudio(stage) {
  failing[stage] = true;
}

export class AudioPlayer {
  constructor(contentType, usage) {
    this.contentType = contentType;
    this.usage = usage;
    this.currentTime = 0;
    this.id = audioLog.filter((entry) => entry.event === 'create').length;
    this._src = '';
    audioLog.push({ event: 'create', player: this.id, contentType, usage });
  }
  initialize() {
    audioLog.push({ event: 'initialize', player: this.id });
    return failing.initialize
      ? Promise.reject(new Error('media pipeline unavailable'))
      : Promise.resolve();
  }
  get src() {
    return this._src;
  }
  set src(value) {
    this._src = value;
    audioLog.push({ event: 'src', player: this.id, src: value });
  }
  play() {
    audioLog.push({
      event: 'play',
      player: this.id,
      src: this._src,
      from: this.currentTime,
    });
    return failing.play
      ? Promise.reject(new Error('not supported'))
      : Promise.resolve();
  }
  pause() {
    audioLog.push({ event: 'pause', player: this.id });
  }
}

// Test-only: forget every player, as a fresh launch would.
export function resetAudio() {
  audioLog.length = 0;
  failing.initialize = false;
  failing.play = false;
}

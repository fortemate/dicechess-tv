// Stand-in for @amazon-devices/react-native-w3cmedia in Node. Records what a
// player was asked to do, which is all a test can know: nothing here makes sound.
export const AudioContentType = { CONTENT_TYPE_SONIFICATION: 4 };
export const AudioUsageType = { USAGE_GAME: 6 };

export const audioLog = [];
const players = new Map();

// Native events are independent of play() resolving. Tests choose when the
// decoder ends a clip or fails it, including after a stop or replacement.
export function audioEvent(id, event) {
  players.get(id)?.emit(event);
}

export function audioListenerCount(id) {
  return [...(players.get(id)?.listeners.values() ?? [])].reduce(
    (total, listeners) => total + listeners.size,
    0,
  );
}

// Test-only: make the next players fail where a device's media stack might.
const failing = { initialize: false, play: false, pause: false };
export function failAudio(stage) {
  failing[stage] = true;
}

// Test-only: keep the next players initialising until releaseAudio(), as a slow
// media pipeline would.
let held = null;
export function holdAudio() {
  held = [];
}
export function releaseAudio() {
  const waiting = held ?? [];
  held = null;
  for (const release of waiting) release();
}

// Test-only: keep the next plays starting until releasePlays(), as a slow
// media pipeline would.
let starting = null;
export function holdPlays() {
  starting = [];
}
export function releasePlays() {
  const waiting = starting ?? [];
  starting = null;
  for (const release of waiting) release();
}

export class AudioPlayer {
  constructor(contentType, usage) {
    this.contentType = contentType;
    this.usage = usage;
    this._time = 0;
    this._volume = 1;
    this.id = audioLog.filter((entry) => entry.event === 'create').length;
    this._src = '';
    this.initialized = false;
    this.duration = Number.NaN;
    this.released = false;
    this.listeners = new Map();
    players.set(this.id, this);
    audioLog.push({ event: 'create', player: this.id, contentType, usage });
  }
  initialize() {
    audioLog.push({ event: 'initialize', player: this.id });
    if (failing.initialize)
      return Promise.reject(new Error('media pipeline unavailable'));
    const ready = held
      ? new Promise((done) => held.push(done))
      : Promise.resolve();
    return ready.then(() => {
      if (this.released) return;
      this.initialized = true;
      if (this._src) {
        this.duration = 1;
        this.emit('canplay');
      }
    });
  }
  get currentTime() {
    return this._time;
  }
  set currentTime(seconds) {
    this._time = seconds;
    audioLog.push({ event: 'seek', player: this.id, to: seconds });
  }
  get volume() {
    return this._volume;
  }
  set volume(gain) {
    this._volume = gain;
    audioLog.push({ event: 'volume', player: this.id, to: gain });
  }
  get src() {
    return this._src;
  }
  set src(value) {
    this._src = value;
    audioLog.push({ event: 'src', player: this.id, src: value });
    if (this.initialized) {
      this.duration = 1;
      this.emit('canplay');
    }
  }
  play() {
    audioLog.push({
      event: 'play',
      player: this.id,
      src: this._src,
      from: this._time,
      volume: this._volume,
    });
    if (failing.play) return Promise.reject(new Error('not supported'));
    const played = starting
      ? new Promise((done) => starting.push(done))
      : Promise.resolve();
    return played.then(() => this.emit('playing'));
  }
  pause() {
    if (failing.pause) throw new Error('not supported');
    audioLog.push({ event: 'pause', player: this.id });
  }
  addEventListener(event, listener) {
    const listeners = this.listeners.get(event) ?? new Set();
    listeners.add(listener);
    this.listeners.set(event, listeners);
  }
  removeEventListener(event, listener) {
    this.listeners.get(event)?.delete(listener);
  }
  emit(event) {
    for (const listener of [...(this.listeners.get(event) ?? [])]) listener();
  }
  deinitialize() {
    this.released = true;
    audioLog.push({ event: 'deinitialize', player: this.id });
    return Promise.resolve();
  }
}

// Test-only: forget every player, as a fresh launch would.
export function resetAudio() {
  audioLog.length = 0;
  players.clear();
  failing.initialize = false;
  failing.play = false;
  failing.pause = false;
  held = null;
  starting = null;
}

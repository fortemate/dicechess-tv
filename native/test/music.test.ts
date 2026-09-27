// The adaptive music player (#76), on fake players and a fake clock: what plays
// when, how it fades, how a loop hands over, and what leaving the foreground
// does.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createMusic,
  loadCatalogue,
  CROSSFADE_MS,
  RESUME_DELAY_MS,
  SEAM_MS,
  STOP_MS,
  type Catalogue,
  type Clock,
} from '../src/music';

class FakeClock implements Clock {
  t = 0;
  private timers: { at: number; run: () => void; every: number }[] = [];
  now() {
    return this.t;
  }
  every(ms: number, run: () => void) {
    const timer = { at: this.t + ms, run, every: ms };
    this.timers.push(timer);
    return () => {
      this.timers = this.timers.filter((each) => each !== timer);
    };
  }
  after(ms: number, run: () => void) {
    const timer = { at: this.t + ms, run, every: 0 };
    this.timers.push(timer);
    return () => {
      this.timers = this.timers.filter((each) => each !== timer);
    };
  }
  // Runs every timer due within `ms`, in order, letting promises settle after
  // each, as the event loop would.
  async advance(ms: number) {
    const end = this.t + ms;
    for (;;) {
      const next = this.timers
        .filter((timer) => timer.at <= end)
        .sort((a, b) => a.at - b.at)[0];
      if (!next) break;
      this.t = next.at;
      if (next.every) next.at += next.every;
      else this.timers = this.timers.filter((each) => each !== next);
      next.run();
      await flush();
    }
    this.t = end;
    await flush();
  }
}

const flush = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
};

// A player whose position runs on the fake clock while it plays.
class FakePlayer {
  volume = 1;
  playing = false;
  private file = '';
  private at = 0;
  private since = 0;
  constructor(
    private readonly clock: FakeClock,
    readonly id: number,
    private readonly log: string[],
  ) {}
  get src() {
    return this.file;
  }
  set src(value: string) {
    this.file = value;
    this.at = 0;
    this.since = this.clock.now();
  }
  get currentTime() {
    return this.playing
      ? this.at + (this.clock.now() - this.since) / 1000
      : this.at;
  }
  set currentTime(value: number) {
    this.at = value;
    this.since = this.clock.now();
  }
  initialize() {
    return Promise.resolve();
  }
  play() {
    this.at = this.currentTime;
    this.since = this.clock.now();
    this.playing = true;
    this.log.push(`${this.id} play ${this.file.split('/').pop()}`);
    return Promise.resolve();
  }
  pause() {
    this.at = this.currentTime;
    this.playing = false;
    this.log.push(`${this.id} pause`);
  }
}

const CATALOGUE: Catalogue = {
  tracks: {
    menu: { file: 'menu.mp3', loopStart: 0, loopEnd: 190, gainDb: 0 },
    calm: { file: 'calm.mp3', loopStart: 0, loopEnd: 180, gainDb: 0 },
    tense: { file: 'tense.mp3', loopStart: 0, loopEnd: 210, gainDb: -2 },
    critical: {
      file: 'critical.mp3',
      loopStart: 0.7,
      loopEnd: 154,
      gainDb: -2,
    },
  },
};

const rig = async (catalogue: Catalogue | null = CATALOGUE) => {
  const clock = new FakeClock();
  const log: string[] = [];
  const players: FakePlayer[] = [];
  const reports: string[] = [];
  const music = createMusic({
    clock,
    root: '/music',
    report: (line) => reports.push(line),
    createPlayer: () => {
      const player = new FakePlayer(clock, players.length, log);
      players.push(player);
      return player as never;
    },
  });
  music.setCatalogue(catalogue);
  await flush();
  const playing = () =>
    players
      .filter((player) => player.playing)
      .map((player) => player.src.split('/').pop());
  return { clock, log, players, reports, music, playing };
};

test('without a catalogue nothing is created and nothing plays', async () => {
  const { music, players } = await rig(null);
  music.setRole('menu');
  await flush();
  assert.equal(players.length, 0);
});

test('the first theme fades in from its loop start', async () => {
  const { music, clock, players, playing } = await rig();
  music.setRole('critical');
  await flush();
  assert.deepEqual(playing(), ['critical.mp3']);
  const player = players.find((each) => each.playing)!;
  assert.equal(player.src, '/music/critical.mp3');
  // Started silent, then moved to where the loop begins.
  assert.equal(player.volume, 0);
  assert.ok(Math.abs(player.currentTime - 0.7) < 0.01);
  await clock.advance(CROSSFADE_MS / 4);
  assert.ok(player.volume > 0 && player.volume < 0.8);
  await clock.advance(CROSSFADE_MS);
  // Full, less the track's levelling gain.
  assert.ok(Math.abs(player.volume - 10 ** (-2 / 20)) < 1e-9);
});

test('a change of level crossfades over two seconds on the other player', async () => {
  const { music, clock, players, playing } = await rig();
  music.setRole('calm');
  await clock.advance(10_000);
  music.setRole('tense');
  await flush();
  assert.deepEqual(playing().sort(), ['calm.mp3', 'tense.mp3']);
  const calm = players.find((each) => each.src.endsWith('calm.mp3'))!;
  const tense = players.find((each) => each.src.endsWith('tense.mp3'))!;
  assert.notEqual(calm, tense);
  await clock.advance(CROSSFADE_MS / 2);
  assert.ok(calm.volume > 0 && calm.volume < 1);
  assert.ok(tense.volume > 0);
  await clock.advance(CROSSFADE_MS / 2 + 100);
  assert.deepEqual(playing(), ['tense.mp3']);
});

test('a change of level starts the theme from its beginning, even one heard before', async () => {
  // The owner chose this by ear: a theme joined in the middle sounded wrong.
  const { music, clock, players } = await rig();
  music.setRole('menu');
  await clock.advance(30_000);
  music.setRole('calm');
  await clock.advance(20_000);
  music.setRole('menu');
  await flush();
  const menu = players.find(
    (each) => each.playing && each.src.endsWith('menu.mp3'),
  )!;
  assert.ok(menu.currentTime < 0.5, `${menu.currentTime}`);
});

test('a theme still fading out fades back in rather than starting over', async () => {
  const { music, clock, log } = await rig();
  music.setRole('calm');
  await clock.advance(10_000);
  music.setRole('tense');
  await clock.advance(500);
  music.setRole('calm');
  await clock.advance(CROSSFADE_MS + 100);
  // calm was played once and never paused.
  assert.deepEqual(
    log.filter((line) => line.includes('calm')),
    ['0 play calm.mp3'],
  );
});

// A short loop, so a seam comes quickly: from 1 s, the seam begins after 16 s.
const SHORT_LOOP: Catalogue = {
  tracks: {
    calm: { file: 'calm.mp3', loopStart: 1, loopEnd: 20, gainDb: 0 },
    tense: { file: 'tense.mp3', loopStart: 0, loopEnd: 60, gainDb: 0 },
  },
};

test('the old half of a seam never fades back in: its theme starts over and keeps looping', async () => {
  // The old half has handed over and will not loop again. Faded back in, it
  // would play out its last seconds and leave silence.
  const { music, clock, players } = await rig(SHORT_LOOP);
  music.setRole('calm');
  // A second into the seam the level changes, and comes back half a second on.
  await clock.advance(17_000);
  music.setRole('tense');
  await clock.advance(500);
  music.setRole('calm');
  await clock.advance(10_000);
  const calm = players.filter(
    (each) => each.playing && each.src.endsWith('calm.mp3'),
  );
  assert.equal(calm.length, 1);
  // A fresh pass inside its loop, not the old one playing on past its end.
  assert.ok(calm[0].currentTime < 20, `${calm[0].currentTime}`);
});

test('a theme that went past its seam while fading out starts over rather than hand over late', async () => {
  const { music, clock, players } = await rig(SHORT_LOOP);
  music.setRole('calm');
  // Half a second before the seam the level changes, so calm fades out through
  // it without handing over, and comes back 0.8 s later, past it.
  await clock.advance(15_500);
  music.setRole('tense');
  await clock.advance(800);
  music.setRole('calm');
  await flush();
  const fresh = players.find(
    (each) =>
      each.playing && each.src.endsWith('calm.mp3') && each.currentTime < 1.5,
  );
  assert.ok(fresh, 'calm starts again from its loop start');
});

test('a pass about to end hands over to a fresh pass on the other player, over 3 s', async () => {
  const { music, clock, players, playing } = await rig({
    tracks: {
      calm: { file: 'calm.mp3', loopStart: 1, loopEnd: 20, gainDb: 0 },
    },
  });
  music.setRole('calm');
  // The pass starts at the loop start, 1 s, and the seam begins 3 s before the
  // loop end at 20 s: after 16 s of play.
  await clock.advance(16_100);
  const [first, second] = players;
  assert.ok(first.playing && second.playing);
  assert.ok(second.currentTime < 1.2, `${second.currentTime}`);
  // Halfway through, both are heard at the same level: an equal-power curve.
  await clock.advance(1_400);
  assert.ok(Math.abs(first.volume - second.volume) < 0.05);
  await clock.advance(SEAM_MS);
  assert.deepEqual(playing(), ['calm.mp3']);
  assert.equal(first.playing, false);
  // And the pass after that goes back to the first.
  await clock.advance(16_000);
  assert.ok(first.playing, 'the first player takes the third pass');
});

test('leaving the foreground stops at once; coming back waits, then resumes where it was', async () => {
  const { music, clock, players, playing } = await rig();
  music.setRole('menu');
  await clock.advance(5_000);
  music.setSuspended(true);
  assert.deepEqual(playing(), []);
  music.setSuspended(false);
  await clock.advance(RESUME_DELAY_MS - 10);
  assert.deepEqual(playing(), [], 'not before the delay');
  await clock.advance(20);
  assert.deepEqual(playing(), ['menu.mp3']);
  const menu = players.find((each) => each.playing)!;
  assert.ok(menu.currentTime > 4.9 && menu.currentTime < 5.5);
});

test('a focus while already in the foreground restarts nothing', async () => {
  const { music, clock, log } = await rig();
  music.setRole('menu');
  await clock.advance(3_000);
  music.setSuspended(false);
  await clock.advance(1_000);
  assert.deepEqual(log, ['0 play menu.mp3']);
});

test('an active state taken away within the delay never resumes', async () => {
  const { music, clock, playing } = await rig();
  music.setRole('menu');
  await clock.advance(3_000);
  music.setSuspended(true);
  music.setSuspended(false);
  await clock.advance(200);
  music.setSuspended(true);
  await clock.advance(1_000);
  assert.deepEqual(playing(), []);
});

test('turning music off fades it out; turning it on brings the theme back', async () => {
  const { music, clock, playing } = await rig();
  music.setRole('calm');
  await clock.advance(3_000);
  music.setEnabled(false);
  await clock.advance(STOP_MS + 100);
  assert.deepEqual(playing(), []);
  music.setRole('tense');
  await clock.advance(1_000);
  assert.deepEqual(playing(), [], 'off stays off');
  music.setEnabled(true);
  await flush();
  assert.deepEqual(playing(), ['tense.mp3']);
});

test('the volume setting scales every player at once', async () => {
  const { music, clock, players } = await rig();
  music.setRole('menu');
  await clock.advance(CROSSFADE_MS);
  music.setVolume(0.5);
  const menu = players.find((each) => each.playing)!;
  assert.ok(Math.abs(menu.volume - 0.5) < 1e-9);
});

test('after a result the music falls silent before the menu theme returns', async () => {
  const { music, clock, playing } = await rig();
  music.setRole('critical');
  await clock.advance(5_000);
  music.setRole('menu', 2_500);
  await clock.advance(1_200);
  assert.deepEqual(playing(), [], 'faded out');
  await clock.advance(1_000);
  assert.deepEqual(playing(), [], 'still silent');
  await clock.advance(400);
  assert.deepEqual(playing(), ['menu.mp3']);
});

test('a player that cannot be made is reported, and nothing throws', async () => {
  const reports: string[] = [];
  const music = createMusic({
    clock: new FakeClock(),
    report: (line) => reports.push(line),
    createPlayer: () => {
      throw new Error('no audio');
    },
  });
  music.setCatalogue(CATALOGUE);
  music.setRole('menu');
  music.setSuspended(true);
  music.setSuspended(false);
  await flush();
  assert.match(reports.join('\n'), /player not created: Error: no audio/);
});

test('the catalogue is read from the package, and a build without music has none', async () => {
  const good = {
    tracks: {
      menu: { file: 'menu.mp3', loopStart: 0, loopEnd: 190, gainDb: 0 },
      calm: { file: 'calm.mp3', loopStart: 5, loopEnd: 2, gainDb: 0 },
    },
  };
  let asked = '';
  const catalogue = await loadCatalogue('/pkg/assets/music', async (url) => {
    asked = url;
    return { ok: true, json: async () => good };
  });
  assert.equal(asked, 'file:///pkg/assets/music/music.json');
  // A loop that ends before it starts is dropped.
  assert.deepEqual(Object.keys(catalogue!.tracks), ['menu']);
  assert.equal(
    await loadCatalogue('/x', async () => ({
      ok: false,
      json: async () => ({}),
    })),
    null,
  );
  assert.equal(
    await loadCatalogue('/x', async () => {
      throw new Error('no such file');
    }),
    null,
  );
});

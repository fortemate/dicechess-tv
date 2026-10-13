// The adaptive music player (#76), on fake players and a fake clock: what plays
// when, how it fades, how a loop hands over, and what leaving the foreground
// does.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createMusic,
  loadCatalogue,
  CROSSFADE_MS,
  DUCK_DB,
  DUCK_MS,
  RESUME_DELAY_MS,
  SEAM_MS,
  START_WAIT_MS,
  STOP_MS,
  UNDUCK_MS,
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

// A clock whose ticker comes only every `period` ms, however often it was
// asked for: a JavaScript thread held up by the danger search, as on a Fire TV
// Stick (#376). Timers set with `after` still keep their time.
class LateClock extends FakeClock {
  constructor(private readonly period: number) {
    super();
  }
  every(_ms: number, run: () => void) {
    return super.every(this.period, run);
  }
}

const flush = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
};

// A player whose position runs on the fake clock while it plays. With a `lag`,
// it is heard only that long after it starts or moves, as a fresh player on a
// Fire TV Stick is about a second after play() (#376).
class FakePlayer {
  volume = 1;
  playing = false;
  lag = 0;
  // How many times a track was set (#374).
  given = 0;
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
    this.given++;
    this.file = value;
    this.at = 0;
    this.since = this.clock.now();
  }
  get currentTime() {
    return this.playing
      ? this.at + Math.max(0, this.clock.now() - this.since - this.lag) / 1000
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
  deinitialize() {
    this.released = true;
    this.log.push(`${this.id} release`);
    return Promise.resolve();
  }
  released = false;
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

const rig = async (
  catalogue: Catalogue | null = CATALOGUE,
  clock: FakeClock = new FakeClock(),
) => {
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
  // Faded out, the first player is let go (#374).
  assert.ok(first.released);
  // And the pass after that starts on a fresh player of its own.
  await clock.advance(16_000);
  const third = players.find((player) => player.playing && player !== second);
  assert.ok(third && third !== first, 'a fresh player takes the third pass');
});

// On a Stick the ticker was held up for a second and more while the danger
// search ran, and a fade moved a step a tick took 12 s or more to cross over
// (#376). Worked out from the clock, a fade is where it should be whenever a
// tick comes.
test('a change of level still crosses over in two seconds when the ticks come late', async () => {
  const { music, clock, players, playing } = await rig(
    CATALOGUE,
    new LateClock(1000),
  );
  music.setRole('calm');
  await clock.advance(10_000);
  const calm = players.find((each) => each.playing)!;
  assert.ok(Math.abs(calm.volume - 1) < 1e-9);
  music.setRole('tense');
  await clock.advance(1000);
  const tense = players.find((each) => each.src.endsWith('tense.mp3'))!;
  // Halfway, on the one tick that came: both heard at the same level.
  assert.ok(Math.abs(calm.volume - tense.volume / 10 ** (-2 / 20)) < 1e-9);
  await clock.advance(CROSSFADE_MS - 1000);
  assert.deepEqual(playing(), ['tense.mp3']);
  assert.ok(Math.abs(tense.volume - 10 ** (-2 / 20)) < 1e-9);
});

test('the duck keeps its time when the ticks come late', async () => {
  const { music, clock, players } = await rig(CATALOGUE, new LateClock(1000));
  music.setRole('calm');
  await clock.advance(3000);
  const calm = players.find((each) => each.playing)!;
  const ducked = 10 ** (DUCK_DB / 20);
  music.setDucked(true);
  await clock.advance(1000);
  assert.ok(Math.abs(calm.volume - ducked) < 1e-9, `ducked to ${calm.volume}`);
  music.setDucked(false);
  await clock.advance(1000);
  assert.ok(Math.abs(calm.volume - 1) < 1e-9, `back to ${calm.volume}`);
});

test('a seam still crosses over in three seconds when the ticks come late', async () => {
  const { music, clock, players, playing } = await rig(
    {
      tracks: {
        calm: { file: 'calm.mp3', loopStart: 1, loopEnd: 20, gainDb: 0 },
      },
    },
    new LateClock(1000),
  );
  music.setRole('calm');
  // The first tick past 16 s of play starts the seam.
  await clock.advance(17_000);
  const [first, second] = players;
  assert.ok(first.playing && second.playing);
  await clock.advance(SEAM_MS);
  assert.deepEqual(playing(), ['calm.mp3']);
  assert.equal(first.playing, false);
  assert.ok(Math.abs(second.volume - 1) < 1e-9);
});

// A fade's duration is for the whole way: one turned halfway through has half
// of it left, as when it moved a step a tick.
test('a fade turned on its way keeps its rate, so it ends sooner', async () => {
  const { music, clock, players, playing } = await rig();
  music.setRole('calm');
  await clock.advance(10_000);
  music.setRole('tense');
  await clock.advance(CROSSFADE_MS / 2);
  const calm = players.find((each) => each.src.endsWith('calm.mp3'))!;
  // Halfway out, calm comes back: half the way in 1 s, not 2 s.
  music.setRole('calm');
  await clock.advance(CROSSFADE_MS / 4);
  const quarter = Math.sin((0.75 * Math.PI) / 2);
  assert.ok(Math.abs(calm.volume - quarter) < 1e-9, `calm at ${calm.volume}`);
  await clock.advance(CROSSFADE_MS / 4 + 100);
  assert.ok(Math.abs(calm.volume - 1) < 1e-9);
  assert.deepEqual(playing(), ['calm.mp3']);
});

// The players made ready and not yet used start `ms` late.
const lagging = (players: FakePlayer[], ms: number) => {
  for (const player of players)
    if (!player.playing && !player.src) player.lag = ms;
};

test('a new theme fades in once it is heard, and the old one plays on until then (#376)', async () => {
  const { music, clock, players, playing } = await rig();
  music.setRole('calm');
  await clock.advance(10_000);
  lagging(players, 1200);
  music.setRole('tense');
  await clock.advance(1000);
  const calm = players.find((each) => each.src.endsWith('calm.mp3'))!;
  const tense = players.find((each) => each.src.endsWith('tense.mp3'))!;
  assert.equal(tense.volume, 0);
  assert.ok(Math.abs(calm.volume - 1) < 1e-9, `calm at ${calm.volume}`);
  // Once heard, the two cross over from that same moment: on the equal-power
  // curve, how far one has faded in is how far the other has faded out.
  await clock.advance(1200);
  const fadeOf = (volume: number, gainDb = 0) =>
    (Math.asin(Math.min(1, volume / 10 ** (gainDb / 20))) * 2) / Math.PI;
  assert.ok(tense.volume > 0 && calm.volume < 1);
  assert.ok(
    Math.abs(fadeOf(calm.volume) + fadeOf(tense.volume, -2) - 1) < 1e-9,
    `calm ${calm.volume}, tense ${tense.volume}`,
  );
  await clock.advance(CROSSFADE_MS / 2 + 100);
  assert.deepEqual(playing(), ['tense.mp3']);
});

test('a seam heard late still ends the old pass by its loop end', async () => {
  const { music, clock, players, playing } = await rig({
    tracks: {
      calm: { file: 'calm.mp3', loopStart: 1, loopEnd: 20, gainDb: 0 },
    },
  });
  music.setRole('calm');
  await clock.advance(16_000);
  lagging(players, 1200);
  // The seam begins after 16 s of play, 3 s before the loop end.
  await clock.advance(100);
  const [first, second] = players;
  assert.ok(first.playing && second.playing);
  await clock.advance(1000);
  assert.ok(Math.abs(first.volume - 1) < 1e-9, 'the old pass plays on');
  assert.equal(second.volume, 0);
  // Heard at about 17.25 s, the old pass fades out by 20 s on its own clock.
  await clock.advance(2000);
  assert.equal(first.playing, false);
  assert.ok(first.currentTime <= 20 + 1e-9, `${first.currentTime}`);
  assert.deepEqual(playing(), ['calm.mp3']);
  await clock.advance(SEAM_MS);
  assert.ok(Math.abs(second.volume - 1) < 1e-9);
});

test('a pass never heard gives way after a while, as before', async () => {
  const { music, clock, players, playing } = await rig();
  music.setRole('calm');
  await clock.advance(10_000);
  lagging(players, 60_000);
  music.setRole('tense');
  await clock.advance(START_WAIT_MS + CROSSFADE_MS + 100);
  assert.deepEqual(playing(), ['tense.mp3']);
});

test('a theme asked for again while it waits to be heard starts once', async () => {
  const { music, clock, players } = await rig();
  music.setRole('calm');
  await clock.advance(10_000);
  lagging(players, 1200);
  music.setRole('tense');
  await clock.advance(500);
  music.setRole('tense');
  await clock.advance(2000);
  assert.equal(
    players.filter((each) => each.src.endsWith('tense.mp3')).length,
    1,
  );
});

test('turning back while the new theme waits drops it, and the old one never dips', async () => {
  const { music, clock, players, playing } = await rig();
  music.setRole('calm');
  await clock.advance(10_000);
  lagging(players, 1200);
  music.setRole('tense');
  await clock.advance(500);
  music.setRole('calm');
  await clock.advance(200);
  const calm = players.find((each) => each.src.endsWith('calm.mp3'))!;
  const tense = players.find((each) => each.src.endsWith('tense.mp3'))!;
  assert.deepEqual(playing(), ['calm.mp3']);
  assert.ok(tense.released);
  assert.ok(Math.abs(calm.volume - 1) < 1e-9);
});

// On the Stick's OS 2602000051520, a player given a second track now and then
// hung, and one that had loaded a track kept working even paused (#374).
test('no music player is ever given a second track, and every silent one is let go', async () => {
  const { music, clock, players } = await rig(SHORT_LOOP);
  for (const role of ['calm', 'tense', 'calm', 'tense', 'calm'] as const) {
    music.setRole(role);
    // Long enough for calm's 19 s loop to hand over at least once.
    await clock.advance(25_000);
  }
  music.setEnabled(false);
  await clock.advance(5_000);
  for (const player of players)
    assert.ok(player.given <= 1, `player ${player.id} given ${player.given}`);
  // Every player that loaded a track has been let go; the rest are ready.
  for (const player of players.filter((each) => each.given))
    assert.ok(player.released, `player ${player.id} kept`);
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

test('a bot line ducks the music quickly, and it comes back more slowly (#159)', async () => {
  const { music, clock, players } = await rig();
  music.setRole('calm');
  await clock.advance(CROSSFADE_MS);
  const calm = players.find((each) => each.playing)!;
  assert.ok(Math.abs(calm.volume - 1) < 1e-9);
  const ducked = 10 ** (DUCK_DB / 20);
  music.setDucked(true);
  await clock.advance(DUCK_MS);
  assert.ok(Math.abs(calm.volume - ducked) < 1e-9, `ducked to ${calm.volume}`);
  music.setDucked(false);
  await clock.advance(DUCK_MS);
  assert.ok(calm.volume > ducked && calm.volume < 1, 'still coming back');
  await clock.advance(UNDUCK_MS);
  assert.ok(Math.abs(calm.volume - 1) < 1e-9);
  // Ducked while nothing plays, a theme that starts is ducked from the start.
  const quiet = await rig();
  quiet.music.setDucked(true);
  quiet.music.setRole('menu');
  await quiet.clock.advance(CROSSFADE_MS);
  const menu = quiet.players.find((each) => each.playing)!;
  assert.ok(Math.abs(menu.volume - ducked) < 1e-9);
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

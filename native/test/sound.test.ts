import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  audioLog,
  resetAudio,
  failAudio,
  holdAudio,
  releaseAudio,
  holdPlays,
  releasePlays,
  audioEvent,
  audioListenerCount,
} from './stubs/react-native-w3cmedia.mjs';
import {
  createSounds as createAppSounds,
  CLIP_LEAD_SECONDS,
  CLIP_TAIL_MS,
  EFFECTS_RETURN_MS,
  LINE_TAIL_MS,
  LINE_TIMEOUT_MS,
  RESULT_LINE_DELAY_MS,
  SPARE_PLAYERS,
  speechTiming,
  type SoundOptions,
} from '../src/sound';
import { CUE_FILES } from '../src/cueFiles';
import { EFFECT_CLIPS } from '../src/effectSprite';
import { VOICE_FILES } from '../src/voiceFiles';
import type { Cue } from '../../src/core/cues';

type Entry = {
  event: string;
  player: number;
  src?: string;
  from?: number;
  to?: number;
  volume?: number;
  contentType?: number;
  usage?: number;
};

const SPRITE = '/pkg/assets/sfx/effects.mp3';

const log = () => audioLog as Entry[];
// What is heard: a channel's player first plays a moment of silence at volume
// zero, before it waits at its first clip.
const plays = () =>
  log().filter((entry) => entry.event === 'play' && entry.volume !== 0);
const primes = () =>
  log().filter((entry) => entry.event === 'play' && entry.volume === 0);
const effects = () => plays().filter((entry) => entry.src === SPRITE);
const settle = () => new Promise((done) => setTimeout(done, 0));

// The vendored file whose clip a play of the sprite started at.
const clipOf = (entry: Entry) =>
  Object.entries(EFFECT_CLIPS).find(
    ([, clip]) =>
      Math.abs(clip.start - CLIP_LEAD_SECONDS - (entry.from ?? -1)) < 1e-6,
  )?.[0];

// The app's sounds, with the end of each clip held unless a test passes its
// own: a timer left running would reach the next test's log.
const createSounds = (options: SoundOptions = {}) =>
  createAppSounds({
    later: () => undefined,
    endClip: () => undefined,
    wake: () => () => undefined,
    ...options,
  });

// A return to the foreground that makes the effects' players again at once.
const wakeNow = (run: () => void) => {
  run();
  return () => undefined;
};

// The ends of clips handed over instead of run, for the test to run when it
// says.
const ends = () => {
  const held: { run: () => void; wait: number }[] = [];
  return {
    endClip: (run: () => void, wait: number) => {
      held.push({ run, wait });
    },
    held,
    run: () => {
      for (const { run } of held.splice(0)) run();
    },
  };
};

// The channels' players have played their first silence and wait at their
// first clips.
const primed = async (time: ReturnType<typeof ends>) => {
  await settle();
  time.run();
};

const released = () =>
  log()
    .filter((entry) => entry.event === 'deinitialize')
    .map((entry) => entry.player);

// The players given the effects' sprite, and those let go of the others: the
// voices'.
const spritePlayers = () =>
  log()
    .filter((entry) => entry.event === 'src' && entry.src === SPRITE)
    .map((entry) => entry.player);
const lineReleases = () =>
  released().filter((player) => !spritePlayers().includes(player));

const pausesOf = (player: number, after = 0) =>
  log()
    .slice(after)
    .filter((entry) => entry.player === player && entry.event === 'pause')
    .length;

test('a player for each channel loads the effects once, and one is made ready for the next line', async () => {
  resetAudio();
  createSounds();
  await settle();
  const created = log().filter((entry) => entry.event === 'create');
  assert.equal(created.length, 3 + SPARE_PLAYERS);
  // SONIFICATION/GAME is what connects to the audio service; the music/media
  // defaults were measured not to.
  for (const entry of created) {
    assert.equal(entry.contentType, 4);
    assert.equal(entry.usage, 6);
  }
  assert.equal(
    log().filter((entry) => entry.event === 'initialize').length,
    3,
    'unused voice spares must not open native pipelines',
  );
  assert.deepEqual(
    log()
      .filter((entry) => entry.event === 'src')
      .map((entry) => entry.src),
    [SPRITE, SPRITE, SPRITE],
  );
});

test('a voice initializes before loading its source and starts only once', async () => {
  resetAudio();
  const sounds = createSounds();
  sounds.say(line('rolly_capture_2'));
  await settle();
  const said = plays()[0];
  const calls = log()
    .filter((entry) => entry.player === said.player)
    .map((entry) => entry.event);
  assert.ok(calls.indexOf('initialize') < calls.indexOf('src'));
  assert.equal(
    calls.filter((event) => event === 'play').length,
    1,
    'readiness must start playback only once',
  );
  sounds.stopLine();
});

test('early readiness without metadata cannot start a voice', async () => {
  resetAudio();
  holdAudio();
  const sounds = createSounds();
  sounds.say(line('rolly_capture_2'));
  const player = log().find(
    (entry) => entry.event === 'initialize' && entry.player >= 3,
  )!.player;
  audioEvent(player, 'canplay');
  audioEvent(player, 'loadedmetadata');
  assert.equal(plays().length, 0);
  releaseAudio();
  await settle();
  audioEvent(player, 'canplay');
  audioEvent(player, 'loadedmetadata');
  assert.equal(plays().filter((entry) => entry.player === player).length, 1);
  sounds.stopLine();
});

test('the watchdog also bounds initialization that never finishes', async () => {
  resetAudio();
  holdAudio();
  const time = clock();
  const sounds = createSounds({ later: time.later });
  sounds.say(line('rolly_capture_2'));
  time.elapse();
  assert.equal(released().length, 1);
  releaseAudio();
  await settle();
  assert.equal(plays().length, 0);
  assert.equal(released().length, 1);
});

test('a cancelled initialization failure cannot report or start an old line', async () => {
  resetAudio();
  const reports: string[] = [];
  const sounds = createSounds({ report: (message) => reports.push(message) });
  failAudio('initialize');
  sounds.say(line('rolly_capture_2'));
  sounds.stopLine();
  await settle();
  assert.equal(plays().length, 0);
  assert.equal(released().length, 1);
  assert.deepEqual(reports, []);
});

for (const stage of ['deinitialize', 'deinitializeAsync'] as const) {
  test(`a ${stage} failure is reported without keeping speech ducked or throwing`, async () => {
    resetAudio();
    const reports: string[] = [];
    const speech = speaking();
    const sounds = createSounds({
      onSpeech: speech.onSpeech,
      report: (message) => reports.push(message),
    });
    sounds.say(line('rolly_capture_2'));
    await settle();
    const said = plays()[0];
    failAudio(stage);
    assert.doesNotThrow(() => sounds.stopLine());
    await settle();
    assert.deepEqual(speech.heard, [true, false]);
    assert.equal(audioListenerCount(said.player), 0);
    assert.equal(
      log()
        .filter(
          (entry) => entry.event === 'volume' && entry.player === said.player,
        )
        .at(-1)?.to,
      0,
    );
    assert.equal(reports.length, 1);
    assert.match(
      reports[0],
      /sound: voice player not released: Error: native release/,
    );
  });
}

// On the Stick's OS 2602000051520, setting `src` on a player that had already
// played now and then never returned, and the app was closed as not
// responding (#374).
test('no player is ever given a second clip, however the cues and lines come', async () => {
  resetAudio();
  let take = 0;
  const time = clock();
  const sounds = createSounds({ pick: () => take++, later: time.later });
  const cues = Object.keys(CUE_FILES) as Cue[];
  for (let round = 0; round < 3; round++) {
    for (const cue of cues) {
      sounds.play([cue]);
      time.elapse(500);
      await settle();
    }
    for (const id of ['grabby_capture_1', 'host_intro_1', 'grabby_capture_1']) {
      sounds.say({ id, event: 'capture' });
      await settle();
      audioEvent(plays().at(-1)!.player, 'ended');
      time.elapse(LINE_TAIL_MS);
    }
  }
  const given = new Map<number, number>();
  for (const entry of log())
    if (entry.event === 'src')
      given.set(entry.player, (given.get(entry.player) ?? 0) + 1);
  for (const [player, count] of given)
    assert.equal(count, 1, `player ${player} was given ${count} clips`);
  // Every cue was heard, on the three channels' players, and every line on a
  // player of its own, let go once said.
  assert.equal(effects().length, 3 * cues.length);
  assert.equal(new Set(effects().map((entry) => entry.player)).size, 3);
  const lines = plays().filter((entry) => entry.src !== SPRITE);
  assert.equal(lines.length, 9);
  assert.equal(new Set(lines.map((entry) => entry.player)).size, 9);
  assert.equal(
    log().filter((entry) => entry.event === 'deinitialize').length,
    9,
  );
});

test('a cue plays its clip from the sprite, and is paused once the clip is over', async () => {
  resetAudio();
  const time = ends();
  const sounds = createSounds({ pick: () => 1, endClip: time.endClip });
  await primed(time);
  sounds.play(['dice_roll']);
  await settle();
  const [roll] = effects();
  assert.equal(clipOf(roll), 'kenney-casino-audio/dice_throw_2.mp3');
  const clip = EFFECT_CLIPS['kenney-casino-audio/dice_throw_2.mp3'];
  assert.deepEqual(
    time.held.map(({ wait }) => wait),
    [Math.round((clip.seconds + CLIP_LEAD_SECONDS) * 1000) + CLIP_TAIL_MS],
  );
  const before = log().length;
  time.run();
  assert.equal(pausesOf(roll.player, before), 1);
});

test('a new cue on a channel rewinds its player to the new clip, and the old clip ending stops nothing', async () => {
  resetAudio();
  const time = ends();
  const sounds = createSounds({ pick: () => 0, endClip: time.endClip });
  await primed(time);
  sounds.play(['piece_move']);
  await settle();
  sounds.play(['piece_capture']);
  await settle();
  const [move, capture] = effects();
  assert.equal(move.player, capture.player);
  assert.equal(clipOf(move), 'jdsherbert-tabletop/piece_move_1.mp3');
  assert.equal(clipOf(capture), 'jdsherbert-tabletop/piece_impact_1.mp3');
  // The move's end comes while the capture plays: it leaves it alone.
  const [moveEnd, captureEnd] = time.held.splice(0);
  let before = log().length;
  moveEnd.run();
  assert.equal(pausesOf(capture.player, before), 0);
  before = log().length;
  captureEnd.run();
  assert.equal(pausesOf(capture.player, before), 1);

  // The same sound again plays from the start of its clip.
  sounds.play(['piece_capture']);
  await settle();
  assert.equal(clipOf(effects()[2]), 'jdsherbert-tabletop/piece_impact_1.mp3');
});

test('a capture and the win it causes play together, on different players', async () => {
  resetAudio();
  const sounds = createSounds({ pick: () => 0 });
  sounds.play(['piece_capture', 'game_win']);
  await settle();
  const [capture, win] = effects();
  assert.equal(clipOf(capture), 'jdsherbert-tabletop/piece_impact_1.mp3');
  assert.equal(clipOf(win), 'kenney-music-jingles/pizzicato_02.mp3');
  assert.notEqual(capture.player, win.player);
});

// Delayed cues are handed to `later` instead of a timer, and run when the test
// says the time has come.
const clock = () => {
  const waiting: { run: () => void; wait: number }[] = [];
  return {
    later: (run: () => void, wait: number) => {
      waiting.push({ run, wait });
    },
    waits: () => waiting.map(({ wait }) => wait),
    elapse: (wait?: number) => {
      const due = waiting.filter(
        (each) => wait === undefined || each.wait === wait,
      );
      for (const timer of due) waiting.splice(waiting.indexOf(timer), 1);
      for (const { run } of due) run();
    },
  };
};

test('the empty roll is heard after the dice land, and does not cut them short', async () => {
  resetAudio();
  const time = clock();
  const sounds = createSounds({ pick: () => 0, later: time.later });
  sounds.play(['dice_roll', 'no_move']);
  await settle();
  // The dice play at once; the empty roll waits half a second.
  assert.deepEqual(effects().map(clipOf), [
    'kenney-casino-audio/dice_throw_1.mp3',
  ]);
  assert.deepEqual(time.waits(), [500]);
  const before = log().length;
  time.elapse();
  await settle();
  const [dice, empty] = effects();
  assert.equal(clipOf(empty), 'kenney-interface-sounds/glass_004.mp3');
  // Another player, so the clatter is not paused to make way for it.
  assert.notEqual(dice.player, empty.player);
  assert.equal(pausesOf(dice.player, before), 0);
});

test('an empty roll still waiting is dropped when the game moves on', async () => {
  resetAudio();
  const time = clock();
  const sounds = createSounds({ pick: () => 0, later: time.later });
  // The player resigns from the menu before the empty roll is heard: the loss
  // plays on the result player, and the empty roll must not cut it short.
  sounds.play(['dice_roll', 'no_move']);
  sounds.play(['game_loss']);
  time.elapse();
  await settle();
  assert.deepEqual(effects().map(clipOf), [
    'kenney-casino-audio/dice_throw_1.mp3',
    'kenney-music-jingles/pizzicato_01.mp3',
  ]);
  // A silent step, such as a new game, drops it as well.
  sounds.play(['dice_roll', 'no_move']);
  sounds.play([]);
  time.elapse();
  await settle();
  assert.ok(
    !effects().map(clipOf).includes('kenney-interface-sounds/glass_004.mp3'),
  );
});

test('an empty roll muted while it waits is not heard', async () => {
  resetAudio();
  const time = clock();
  const sounds = createSounds({ pick: () => 0, later: time.later });
  sounds.play(['dice_roll', 'no_move']);
  await settle();
  sounds.setMuted(true);
  time.elapse();
  await settle();
  assert.deepEqual(effects().map(clipOf), [
    'kenney-casino-audio/dice_throw_1.mp3',
  ]);
});

test('muted, nothing plays, and what was playing stops', async () => {
  resetAudio();
  const sounds = createSounds({ pick: () => 0 });
  sounds.play(['dice_roll', 'piece_move', 'game_draw']);
  await settle();
  const playing = effects().map((entry) => entry.player);
  const before = log().length;
  sounds.setMuted(true);
  for (const player of playing) assert.equal(pausesOf(player, before), 1);
  sounds.play(['dice_roll', 'piece_move', 'game_draw']);
  await settle();
  assert.equal(effects().length, 3);
  sounds.setMuted(false);
  sounds.play(['game_draw']);
  await settle();
  assert.equal(effects().length, 4);
});

test('away from the foreground, nothing plays, and the setting is kept', async () => {
  resetAudio();
  const sounds = createSounds({ pick: () => 0, later: () => undefined });
  sounds.play(['dice_roll', 'piece_move', 'game_draw']);
  sounds.say({ id: 'host_intro_1', event: 'intro' });
  await settle();
  assert.equal(plays().length, 4);
  const before = log().length;
  sounds.setSuspended(true);
  // The three channels are let go, and the voice too, without a pause.
  const away = log().slice(before);
  assert.equal(away.filter((entry) => entry.event === 'pause').length, 0);
  assert.deepEqual(
    away
      .filter((entry) => entry.event === 'deinitialize')
      .map((entry) => entry.player)
      .sort(),
    [...spritePlayers(), plays().find((e) => e.src !== SPRITE)!.player].sort(),
  );
  sounds.play(['dice_roll', 'piece_move', 'game_draw']);
  await settle();
  assert.equal(plays().length, 4);
  // Back in the foreground, sound plays again: it was never muted.
  sounds.setSuspended(false);
  sounds.play(['game_draw']);
  await settle();
  assert.equal(plays().length, 5);
  // And muting still wins over coming back.
  sounds.setMuted(true);
  sounds.setSuspended(false);
  sounds.play(['game_draw']);
  await settle();
  assert.equal(plays().length, 5);
});

test('a cue waiting for initialization is dropped across suspension, even after a quick return', async () => {
  resetAudio();
  holdAudio();
  const sounds = createSounds({ pick: () => 0 });
  sounds.play(['dice_roll']);
  // Away and back while the players are still initializing: an old cue must
  // not start late after the overlay has closed (#254).
  sounds.setSuspended(true);
  sounds.setSuspended(false);
  releaseAudio();
  await settle();
  assert.equal(plays().length, 0, 'the old roll is never heard');
  sounds.play(['dice_roll']);
  await settle();
  assert.equal(plays().length, 1, 'a new roll still plays');
});

test('a delayed effect is discarded across blur/focus, rather than replayed on return', async () => {
  resetAudio();
  const time = clock();
  const sounds = createSounds({ pick: () => 0, later: time.later });
  sounds.play(['dice_roll', 'no_move']);
  await settle();
  sounds.setSuspended(true);
  sounds.setSuspended(false);
  time.elapse();
  await settle();
  assert.equal(plays().length, 1, 'the delayed no-move cue is dropped');
  sounds.play(['piece_move']);
  await settle();
  assert.equal(plays().length, 2, 'the next live move is heard');
});

test('a quick blur/focus still silences an already playing effect and line', async () => {
  resetAudio();
  const sounds = createSounds({ pick: () => 0 });
  sounds.play(['dice_roll']);
  sounds.say({ id: 'host_intro_1', event: 'intro' });
  await settle();
  const [roll] = effects();
  const said = plays().find((entry) => entry.src !== SPRITE)!;
  assert.equal(clipOf(roll), 'kenney-casino-audio/dice_throw_1.mp3');
  assert.match(said.src ?? '', /host_intro_1\.mp3$/);
  // Focus is back before a promise callback could run: the players that are
  // making sound must already have been silenced and let go.
  sounds.setSuspended(true);
  sounds.setSuspended(false);
  const silenced = log().filter(
    (entry) => entry.event === 'volume' && entry.player === roll.player,
  );
  assert.equal(silenced.at(-1)?.to, 0, 'the dice fall silent');
  assert.ok(released().includes(roll.player), 'the dice are let go');
  assert.ok(released().includes(said.player), 'the line stops');
});

// ── The effects' players while the app is away (#313) ─────────────────────────

// Returns to the foreground held for the test to fire, as a timer would, unless
// a later leave canceled them.
const wakes = () => {
  const held: { run: () => void; wait: number; cancelled: boolean }[] = [];
  return {
    held,
    wake: (run: () => void, wait: number) => {
      const timer = { run, wait, cancelled: false };
      held.push(timer);
      return () => {
        timer.cancelled = true;
      };
    },
    fire: () => {
      for (const timer of held.splice(0)) if (!timer.cancelled) timer.run();
    },
  };
};

const created = () =>
  log()
    .filter((entry) => entry.event === 'create')
    .map((entry) => entry.player);

test('away, the effects’ players are let go without a pause, and fresh ones are made a moment after the return (#313)', async () => {
  resetAudio();
  const time = wakes();
  const sounds = createSounds({ pick: () => 0, wake: time.wake });
  sounds.play(['dice_roll']);
  await settle();
  const first = spritePlayers();
  assert.equal(first.length, 3);
  const before = log().length;
  sounds.setSuspended(true);
  const away = log().slice(before);
  for (const player of first)
    assert.deepEqual(
      away
        .filter((entry) => entry.player === player)
        .map((entry) => [entry.event, entry.to]),
      [
        ['volume', 0],
        ['deinitialize', undefined],
      ],
      'silenced and let go, never paused first (#386)',
    );
  // Back: nothing is made until the wait is over.
  sounds.setSuspended(false);
  await settle();
  assert.deepEqual(
    time.held.map(({ wait }) => wait),
    [EFFECTS_RETURN_MS],
  );
  assert.deepEqual(spritePlayers(), first);
  time.fire();
  await settle();
  const second = spritePlayers().slice(3);
  assert.equal(second.length, 3);
  assert.ok(second.every((player) => !first.includes(player)));
  sounds.play(['piece_move']);
  await settle();
  assert.ok(second.includes(effects().at(-1)!.player));
  assert.equal(
    clipOf(effects().at(-1)!),
    'jdsherbert-tabletop/piece_move_1.mp3',
  );
});

test('a cue that comes before the wait is over makes the players at once, and is heard', async () => {
  resetAudio();
  const time = wakes();
  const sounds = createSounds({ pick: () => 0, wake: time.wake });
  await settle();
  sounds.setSuspended(true);
  sounds.setSuspended(false);
  sounds.play(['dice_roll']);
  await settle();
  assert.equal(spritePlayers().length, 6);
  const [roll] = effects();
  assert.ok(spritePlayers().slice(3).includes(roll.player));
  assert.equal(clipOf(roll), 'kenney-casino-audio/dice_throw_1.mp3');
  // The wait, when it is over, makes nothing more.
  time.fire();
  await settle();
  assert.equal(spritePlayers().length, 6);
});

test('away and back again before the wait is over, the players are made once', async () => {
  resetAudio();
  const time = wakes();
  const sounds = createSounds({ wake: time.wake });
  await settle();
  sounds.setSuspended(true);
  sounds.setSuspended(false);
  sounds.setSuspended(true);
  sounds.setSuspended(false);
  time.fire();
  await settle();
  assert.equal(spritePlayers().length, 6);
  // A focus while the app is in front changes nothing.
  sounds.setSuspended(false);
  time.fire();
  await settle();
  assert.equal(spritePlayers().length, 6);
});

test('a clip of the players let go that ends after the return pauses and moves nothing', async () => {
  resetAudio();
  const time = ends();
  const sounds = createSounds({
    pick: () => 0,
    endClip: time.endClip,
    wake: wakeNow,
  });
  // The first silences and a roll, each with its end still to come.
  sounds.play(['dice_roll']);
  await settle();
  const first = spritePlayers();
  const late = time.held.splice(0);
  sounds.setSuspended(true);
  sounds.setSuspended(false);
  await primed(time);
  const second = spritePlayers().slice(3);
  const before = log().length;
  for (const { run } of late) run();
  assert.deepEqual(
    log()
      .slice(before)
      .filter((entry) => [...first, ...second].includes(entry.player)),
    [],
    'the old ends touch neither the let-go players nor the new ones',
  );
  // The new dice player still waits at its own clip, and plays it.
  sounds.play(['dice_roll']);
  await settle();
  const [, roll] = effects();
  assert.ok(second.includes(roll.player));
  assert.equal(clipOf(roll), 'kenney-casino-audio/dice_throw_1.mp3');
});

test('a player still initialising when the app leaves is let go once it is ready, never loaded', async () => {
  resetAudio();
  holdAudio();
  const sounds = createSounds();
  const channels = created().slice(0, 3);
  sounds.setSuspended(true);
  releaseAudio();
  await settle();
  assert.deepEqual(spritePlayers(), []);
  assert.deepEqual(released(), channels);
  assert.equal(log().filter((entry) => entry.event === 'play').length, 0);
});

test('each player is given the sprite once, through any number of trips away', async () => {
  resetAudio();
  const sounds = createSounds({ pick: () => 0, wake: wakeNow });
  for (let trip = 0; trip < 4; trip++) {
    sounds.play(['dice_roll', 'piece_move', 'game_win']);
    await settle();
    sounds.setSuspended(true);
    sounds.setSuspended(false);
    await settle();
  }
  const given = new Map<number, number>();
  for (const entry of log())
    if (entry.event === 'src')
      given.set(entry.player, (given.get(entry.player) ?? 0) + 1);
  assert.ok([...given.values()].every((count) => count === 1));
  // Four sets let go, the fifth in use.
  assert.equal(spritePlayers().length, 15);
  assert.equal(released().length, 12);
  assert.equal(effects().length, 12);
});

test('dispose lets every player go without a pause, and nothing plays afterwards', async () => {
  resetAudio();
  const speech = speaking();
  const sounds = createSounds({ pick: () => 0, onSpeech: speech.onSpeech });
  sounds.play(['dice_roll']);
  sounds.say({ id: 'host_intro_1', event: 'intro' });
  await settle();
  const said = plays().find((entry) => entry.src !== SPRITE)!;
  const before = log().length;
  sounds.dispose();
  assert.ok(spritePlayers().every((player) => released().includes(player)));
  assert.ok(released().includes(said.player));
  assert.equal(
    log()
      .slice(before)
      .filter((entry) => entry.event === 'pause').length,
    0,
  );
  assert.equal(speech.heard.at(-1), false, 'the music is unducked');
  const made = created().length;
  const played = log().filter((entry) => entry.event === 'play').length;
  sounds.setSuspended(true);
  sounds.setSuspended(false);
  sounds.setMuted(false);
  sounds.play(['dice_roll']);
  sounds.say({ id: 'host_intro_1', event: 'intro' });
  await settle();
  assert.equal(created().length, made, 'no player is made after dispose');
  assert.equal(log().filter((entry) => entry.event === 'play').length, played);
});

// A take is chosen when its channel's player waits for it: once the player is
// ready, and again each time a clip ends.
test('a take is chosen among several, and a bad pick cannot fall off the list', async () => {
  resetAudio();
  const time = ends();
  // Only the dice have three takes.
  const picks = [2, 7, -3];
  const sounds = createSounds({
    pick: (count) => (count === 3 ? (picks.shift() ?? 0) : 0),
    endClip: time.endClip,
  });
  for (let roll = 0; roll < 3; roll++) {
    sounds.play(['dice_roll']);
    await settle();
    time.run();
  }
  assert.deepEqual(
    effects().map((entry) => clipOf(entry)?.split('/').pop()),
    ['dice_throw_3.mp3', 'dice_throw_3.mp3', 'dice_throw_1.mp3'],
  );
});

const eventsOf = (player: number, after = 0) =>
  log()
    .slice(after)
    .filter((entry) => entry.player === player)
    .map(({ event, to }) =>
      event === 'seek' || event === 'volume' ? `${event} ${to}` : event,
    );

// A seek asked for just before play() lost the start of a clip on the virtual
// device, now and then the whole clip (#374).
test('between clips a channel waits at a take of its main cue, which then plays with no seek', async () => {
  resetAudio();
  const time = ends();
  const sounds = createSounds({ pick: () => 1, endClip: time.endClip });
  await primed(time);
  const moveAt =
    EFFECT_CLIPS['jdsherbert-tabletop/piece_move_2.mp3'].start -
    CLIP_LEAD_SECONDS;
  const board = log().find(
    (entry) => entry.event === 'seek' && entry.to === moveAt,
  )!.player;
  // Ready, the board's player plays a moment of silence it is not heard to
  // play, and only then waits at the move it will play.
  assert.deepEqual(eventsOf(board).slice(-6), [
    'src',
    'volume 0',
    'play',
    'pause',
    'volume 1',
    `seek ${moveAt}`,
  ]);

  let before = log().length;
  sounds.play(['piece_move']);
  await settle();
  assert.deepEqual(eventsOf(board, before), ['play']);
  assert.equal(clipOf(effects()[0]), 'jdsherbert-tabletop/piece_move_2.mp3');

  // Once the clip is over, it is paused and waits for the next move.
  before = log().length;
  time.run();
  assert.deepEqual(eventsOf(board, before), ['pause', `seek ${moveAt}`]);

  // A capture is not what it waits for: it seeks to its own clip first.
  before = log().length;
  sounds.play(['piece_capture']);
  await settle();
  const captureAt =
    EFFECT_CLIPS['jdsherbert-tabletop/piece_impact_2.mp3'].start -
    CLIP_LEAD_SECONDS;
  assert.deepEqual(eventsOf(board, before), [
    'pause',
    `seek ${captureAt}`,
    'play',
  ]);

  // A move that cuts a clip short finds the player playing, not waiting, and
  // seeks too.
  before = log().length;
  sounds.play(['piece_move']);
  await settle();
  assert.deepEqual(eventsOf(board, before), [
    'pause',
    `seek ${moveAt}`,
    'play',
  ]);
});

test('a cue that comes during the first silence is heard, and the silence ending leaves it alone', async () => {
  resetAudio();
  const time = ends();
  const sounds = createSounds({ pick: () => 0, endClip: time.endClip });
  await settle();
  assert.equal(primes().length, 3);
  const silences = time.held.splice(0);
  sounds.play(['piece_move']);
  await settle();
  const [move] = effects();
  assert.equal(move.volume, 1);
  assert.equal(clipOf(move), 'jdsherbert-tabletop/piece_move_1.mp3');
  const before = log().length;
  for (const { run } of silences) run();
  assert.equal(pausesOf(move.player, before), 0);
});

test('muted, a player plays no first silence', async () => {
  resetAudio();
  createSounds({ muted: true });
  await settle();
  assert.equal(primes().length, 0);
});

// A channel that came up while sound was off plays its first silence once
// sound can be heard, before its first cue, so that cue waits at a clip like
// any other; and only once.
const primedBeforeCue = async (
  turnOn: (sounds: ReturnType<typeof createSounds>) => void,
  options: SoundOptions,
  turnOff?: (sounds: ReturnType<typeof createSounds>) => void,
  // How many first silences there are after turning off and on again: the
  // same three players, or three fresh ones after the app was away.
  again = 3,
) => {
  resetAudio();
  const time = ends();
  const sounds = createSounds({
    pick: () => 0,
    endClip: time.endClip,
    ...options,
  });
  turnOff?.(sounds);
  await settle();
  assert.equal(primes().length, 0);
  turnOn(sounds);
  await primed(time);
  assert.equal(primes().length, 3);
  sounds.play(['piece_move']);
  await settle();
  const [move] = effects();
  const entries = log();
  const prime = entries.findIndex(
    (entry) =>
      entry.event === 'play' &&
      entry.volume === 0 &&
      entry.player === move.player,
  );
  assert.ok(prime >= 0 && prime < entries.indexOf(move), 'primed first');
  assert.equal(clipOf(move), 'jdsherbert-tabletop/piece_move_1.mp3');
  turnOff?.(sounds);
  turnOn(sounds);
  await settle();
  assert.equal(primes().length, again, 'each player primed only once');
};

test('a player ready while muted plays its first silence when sound is turned on', () =>
  primedBeforeCue(
    (sounds) => sounds.setMuted(false),
    { muted: true },
    (sounds) => sounds.setMuted(true),
  ));

test('the players made on the return play their first silence before a cue', () =>
  primedBeforeCue(
    (sounds) => sounds.setSuspended(false),
    { wake: wakeNow },
    (sounds) => sounds.setSuspended(true),
    6,
  ));

test('a first silence that failed to start is tried again when sound comes back on', async () => {
  resetAudio();
  failAudio('play');
  const sounds = createSounds();
  await settle();
  // Each channel tried, and its play was refused.
  assert.equal(primes().length, 3);
  // The media stack recovers; the log starts afresh.
  resetAudio();
  sounds.setMuted(true);
  sounds.setMuted(false);
  await settle();
  assert.equal(primes().length, 3);
});

test('each channel waits for its own main cue', async () => {
  resetAudio();
  const time = ends();
  createSounds({ pick: () => 0, endClip: time.endClip });
  await primed(time);
  const waits = log()
    .filter((entry) => entry.event === 'seek')
    .map((entry) =>
      clipOf({ event: 'play', player: entry.player, from: entry.to }),
    );
  assert.deepEqual(
    waits.sort(),
    [
      CUE_FILES.dice_roll[0],
      CUE_FILES.no_move[0],
      CUE_FILES.piece_move[0],
    ].sort(),
  );
});

test('a player that never initialises is reported, and nothing is thrown', async () => {
  resetAudio();
  failAudio('initialize');
  const reported: string[] = [];
  const sounds = createSounds({ report: (line) => reported.push(line) });
  sounds.play(['piece_move', 'dice_roll', 'game_win']);
  await settle();
  // Spare voices wait to initialize until a line gives them its source.
  assert.equal(reported.length, 3, 'one per effect player');
  for (const line of reported) assert.match(line, /not initialised/);
  assert.equal(plays().length, 0);
});

test('a clip that refuses to play is reported, and nothing is thrown', async () => {
  resetAudio();
  failAudio('play');
  const reported: string[] = [];
  const sounds = createSounds({ report: (line) => reported.push(line) });
  sounds.play(['promotion']);
  await settle();
  await settle();
  // The cue, and each channel's first moment of silence.
  assert.deepEqual(reported.sort(), [
    'sound: board did not start: Error: not supported',
    'sound: dice did not start: Error: not supported',
    'sound: promotion did not play: Error: not supported',
    'sound: result did not start: Error: not supported',
  ]);
});

test('a player that refuses to stop is reported, and nothing is thrown', async () => {
  resetAudio();
  const reported: string[] = [];
  const sounds = createSounds({
    pick: () => 0,
    later: () => undefined,
    report: (line) => reported.push(line),
  });
  sounds.play(['piece_move', 'dice_roll', 'game_win']);
  sounds.say({ id: 'host_intro_1', event: 'intro' });
  await settle();
  failAudio('pause');
  sounds.setMuted(true);
  await settle();
  assert.deepEqual(reported, [
    'sound: board did not stop: Error: not supported',
    'sound: dice did not stop: Error: not supported',
    'sound: result did not stop: Error: not supported',
  ]);
});

// ── The bots' voices (#159) ────────────────────────────────────────────────────

const line = (id: string) => ({
  id,
  event: id.includes('_win_')
    ? ('win' as const)
    : id.includes('_loss_')
      ? ('loss' as const)
      : ('capture' as const),
});

// The speech the app hears about, in order.
const speaking = () => {
  const heard: boolean[] = [];
  return { heard, onSpeech: (on: boolean) => heard.push(on) };
};

test('a line plays its clip on a player of its own, and the app hears it start and end', async () => {
  resetAudio();
  const time = clock();
  const speech = speaking();
  const sounds = createSounds({ later: time.later, onSpeech: speech.onSpeech });
  sounds.say(line('grabby_capture_1'));
  await settle();
  const [said] = plays();
  assert.equal(
    said.src,
    '/pkg/assets/voices/elevenlabs-dicechess-bots/grabby_capture_1.mp3',
  );
  assert.deepEqual(speech.heard, [true]);
  // The duration-based timer is only a watchdog. Normal completion follows
  // the decoder's ended event, then the tail under which music stays ducked.
  assert.deepEqual(time.waits(), [
    Math.round(VOICE_FILES.grabby_capture_1.seconds * 1000) +
      LINE_TAIL_MS +
      LINE_TIMEOUT_MS,
  ]);
  audioEvent(said.player, 'ended');
  assert.equal(time.waits().at(-1), LINE_TAIL_MS);
  time.elapse(LINE_TAIL_MS);
  assert.deepEqual(speech.heard, [true, false]);
  // Said, its player is let go.
  assert.deepEqual(released(), [said.player]);
  assert.equal(audioListenerCount(said.player), 0);
});

test('a late decoder start cannot release a line before its ended event', async () => {
  resetAudio();
  const time = clock();
  const speech = speaking();
  const sounds = createSounds({ later: time.later, onSpeech: speech.onSpeech });
  sounds.say(line('rolly_capture_2'));
  await settle();
  const said = plays()[0];
  // On the Stick the old deadline reached this clip at 2.60 of 3.17 seconds.
  time.elapse(
    Math.round(VOICE_FILES.rolly_capture_2.seconds * 1000) + LINE_TAIL_MS,
  );
  assert.deepEqual(released(), []);
  assert.deepEqual(speech.heard, [true]);
  audioEvent(said.player, 'ended');
  assert.deepEqual(released(), [], 'the last syllable keeps the music ducked');
  time.elapse(LINE_TAIL_MS);
  assert.deepEqual(released(), [said.player]);
  assert.equal(
    pausesOf(said.player),
    0,
    'EOS cleanup never pauses the pipeline',
  );
  assert.equal(audioListenerCount(said.player), 0);
  assert.deepEqual(speech.heard, [true, false]);
});

test('a stale ended tail cannot release or unduck the replacement line', async () => {
  resetAudio();
  const time = clock();
  const speech = speaking();
  const sounds = createSounds({ later: time.later, onSpeech: speech.onSpeech });
  sounds.say(line('grabby_capture_1'));
  await settle();
  const first = plays()[0];
  audioEvent(first.player, 'ended');
  sounds.say(line('rolly_capture_2'));
  await settle();
  const second = plays().at(-1)!;
  const before = [...speech.heard];
  time.elapse(LINE_TAIL_MS);
  audioEvent(first.player, 'error');
  assert.deepEqual(speech.heard, before);
  assert.deepEqual(released(), [first.player]);
  assert.equal(audioListenerCount(first.player), 0);
  sounds.setSuspended(true);
  assert.deepEqual(lineReleases(), [first.player, second.player]);
  assert.equal(audioListenerCount(second.player), 0);
  time.elapse();
  assert.deepEqual(lineReleases(), [first.player, second.player]);
});

test('a native voice error releases the player and restores the music duck', async () => {
  resetAudio();
  const speech = speaking();
  const reports: string[] = [];
  const sounds = createSounds({
    onSpeech: speech.onSpeech,
    report: (message) => reports.push(message),
  });
  sounds.say(line('grabby_capture_1'));
  await settle();
  const said = plays()[0];
  audioEvent(said.player, 'error');
  assert.deepEqual(released(), [said.player]);
  assert.equal(audioListenerCount(said.player), 0);
  assert.deepEqual(speech.heard, [true, false]);
  assert.deepEqual(reports, ['sound: line grabby_capture_1 playback failed']);
});

test('a missing completion event is bounded by a watchdog, and releases once', async () => {
  resetAudio();
  const time = clock();
  const reports: string[] = [];
  const speech = speaking();
  const sounds = createSounds({
    later: time.later,
    onSpeech: speech.onSpeech,
    report: (message) => reports.push(message),
  });
  sounds.say(line('grabby_capture_1'));
  await settle();
  const said = plays()[0];
  time.elapse();
  assert.deepEqual(released(), [said.player]);
  assert.deepEqual(speech.heard, [true, false]);
  assert.deepEqual(reports, [
    'sound: line grabby_capture_1 completion timed out',
  ]);
  audioEvent(said.player, 'ended');
  time.elapse();
  assert.deepEqual(released(), [said.player]);
});

test('a line neither cuts nor is cut by the cues', async () => {
  resetAudio();
  const sounds = createSounds({ pick: () => 0, later: () => undefined });
  sounds.say(line('rolly_capture_2'));
  await settle();
  sounds.play(['piece_capture', 'dice_roll']);
  await settle();
  const voice = plays()[0].player;
  assert.equal(plays().length, 3);
  assert.ok(
    plays()
      .slice(1)
      .every((entry) => entry.player !== voice),
  );
  assert.equal(pausesOf(voice), 0);
});

test('a new line replaces the one being said', async () => {
  resetAudio();
  const speech = speaking();
  const sounds = createSounds({
    later: () => undefined,
    onSpeech: speech.onSpeech,
  });
  sounds.say(line('rampage_capture_1'));
  await settle();
  sounds.say(line('rampage_capture_heavy_2'));
  await settle();
  // Each line on a player of its own (#374): the first is cut short, then let
  // go.
  const [first, second] = plays();
  assert.notEqual(first.player, second.player);
  assert.deepEqual(
    log()
      .filter((entry) => entry.player === first.player)
      .map((entry) => entry.event),
    ['create', 'initialize', 'src', 'play', 'volume', 'deinitialize'],
  );
  assert.equal(second.src?.split('/').pop(), 'rampage_capture_heavy_2.mp3');
  // The music comes up between the two, and ducks again.
  assert.deepEqual(speech.heard, [true, false, true]);
});

test('a win or a loss is said after its jingle, and dropped if another line comes first', async () => {
  resetAudio();
  const time = clock();
  const sounds = createSounds({ later: time.later });
  sounds.say(line('rolly_win_1'));
  await settle();
  assert.equal(plays().length, 0);
  assert.deepEqual(time.waits(), [RESULT_LINE_DELAY_MS]);
  time.elapse();
  await settle();
  assert.equal(plays()[0].src?.split('/').pop(), 'rolly_win_1.mp3');

  // A new game's intro, before the last word was heard: only the intro plays.
  resetAudio();
  const later = clock();
  const again = createSounds({ later: later.later });
  again.say(line('grabby_loss_2'));
  again.say({ id: 'grabby_intro_1', event: 'intro' });
  later.elapse(RESULT_LINE_DELAY_MS);
  await settle();
  assert.deepEqual(
    plays().map((entry) => entry.src?.split('/').pop()),
    ['grabby_intro_1.mp3'],
  );
});

test('the bubble of a line stays until it has been said', () => {
  const clip = VOICE_FILES.rampage_win_3.seconds * 1000;
  assert.deepEqual(speechTiming(line('rampage_win_3')), {
    delayMs: RESULT_LINE_DELAY_MS,
    ms: Math.round(clip) + LINE_TAIL_MS,
  });
  assert.equal(speechTiming(line('nobody_capture_1')), null);
});

test("the Hot Seat host's result waits for the jingle, like a bot's (#202)", () => {
  // A colorless win line picked for White's win still has the event 'win'.
  for (const line of [
    { id: 'host_white_wins_1', event: 'white_wins' },
    { id: 'host_win_1', event: 'win' },
    { id: 'host_draw_2', event: 'draw' },
  ] as const)
    assert.equal(speechTiming(line)?.delayMs, RESULT_LINE_DELAY_MS, line.id);
  assert.deepEqual(speechTiming({ id: 'host_intro_1', event: 'intro' }), {
    delayMs: 0,
    ms: Math.round(VOICE_FILES.host_intro_1.seconds * 1000) + LINE_TAIL_MS,
  });
});

test("the host's line plays her clip on the voice player (#202)", async () => {
  resetAudio();
  const sounds = createSounds({ later: () => undefined });
  sounds.say({ id: 'host_intro_1', event: 'intro' });
  await settle();
  assert.equal(
    plays()[0]?.src,
    '/pkg/assets/voices/elevenlabs-dicechess-host/host_intro_1.mp3',
  );
});

test('a line stopped on its own goes quiet, the next is said, and the settings stay (#202)', async () => {
  resetAudio();
  const speech = speaking();
  const sounds = createSounds({
    later: () => undefined,
    onSpeech: speech.onSpeech,
  });
  sounds.say({ id: 'host_again_3', event: 'again' });
  await settle();
  sounds.stopLine();
  await settle();
  const voice = plays()[0].player;
  assert.equal(log().at(-1)?.event, 'deinitialize');
  assert.equal(log().at(-1)?.player, voice);
  // The music comes back at once.
  assert.deepEqual(speech.heard, [true, false]);
  // The voices are still on: the next line is said.
  sounds.say(line('grabby_capture_2'));
  await settle();
  assert.equal(plays().length, 2);

  // A result still waiting for its jingle is never said.
  resetAudio();
  const time = clock();
  const waiting = createSounds({ later: time.later });
  waiting.say({ id: 'host_white_wins_2', event: 'white_wins' });
  waiting.stopLine();
  time.elapse();
  await settle();
  assert.equal(plays().length, 0);

  // Nor is one asked for while the voice player was still starting up.
  resetAudio();
  holdAudio();
  const loading = createSounds({ later: () => undefined });
  loading.say({ id: 'host_capture_1', event: 'capture' });
  loading.stopLine();
  releaseAudio();
  await settle();
  await settle();
  assert.equal(plays().length, 0);
});

test('with the voices off nothing is said, and a line being said stops; the effects are another setting', async () => {
  resetAudio();
  const speech = speaking();
  const sounds = createSounds({
    later: () => undefined,
    onSpeech: speech.onSpeech,
  });
  sounds.say(line('grabby_capture_3'));
  await settle();
  sounds.setVoices(false);
  await settle();
  const voice = plays()[0].player;
  assert.equal(log().at(-1)?.event, 'deinitialize');
  assert.equal(log().at(-1)?.player, voice);
  assert.deepEqual(speech.heard, [true, false]);
  sounds.say(line('grabby_capture_2'));
  await settle();
  assert.equal(plays().length, 1);

  // Turning the effects off leaves the voices alone, and the other way round.
  resetAudio();
  const effectsOff = createSounds({ muted: true, later: () => undefined });
  effectsOff.say(line('rolly_capture_1'));
  await settle();
  assert.equal(plays().length, 1);
  resetAudio();
  const voicesOff = createSounds({ voices: false, pick: () => 0 });
  voicesOff.say(line('rolly_capture_1'));
  voicesOff.play(['dice_roll']);
  await settle();
  assert.equal(plays().length, 1);
  assert.equal(clipOf(effects()[0]), 'kenney-casino-audio/dice_throw_1.mp3');
});

test('away from the foreground a line stops, and the music is told', async () => {
  resetAudio();
  const speech = speaking();
  const sounds = createSounds({
    later: () => undefined,
    onSpeech: speech.onSpeech,
  });
  sounds.say(line('rampage_capture_2'));
  await settle();
  sounds.setSuspended(true);
  await settle();
  assert.deepEqual(speech.heard, [true, false]);
  sounds.say(line('rampage_capture_3'));
  await settle();
  assert.equal(plays().length, 1, 'nothing is said while away');
});

test('a line without a clip, or one that refuses to play, is reported, and nothing is thrown', async () => {
  resetAudio();
  const reported: string[] = [];
  const speech = speaking();
  const sounds = createSounds({
    report: (entry) => reported.push(entry),
    onSpeech: speech.onSpeech,
  });
  sounds.say(line('nobody_capture_1'));
  failAudio('play');
  sounds.say(line('rolly_capture_3'));
  await settle();
  await settle();
  assert.deepEqual(
    reported.filter((entry) => entry.includes(' line ')),
    [
      'sound: line nobody_capture_1 has no clip',
      'sound: line rolly_capture_3 playback failed',
    ],
  );
  assert.deepEqual(speech.heard, []);
  // Its player is let go rather than kept loaded until the next line.
  assert.deepEqual(
    released(),
    plays().map((entry) => entry.player),
  );
});

// A loaded player kept paused still costs the Stick (#374): however a line
// ends, its player is let go.
test('a line stopped while its player starts is let go, and so is one stopped part way', async () => {
  resetAudio();
  const speech = speaking();
  const time = clock();
  const sounds = createSounds({ later: time.later, onSpeech: speech.onSpeech });
  holdPlays();
  sounds.say(line('grabby_capture_1'));
  await settle();
  sounds.stopLine();
  releasePlays();
  await settle();
  const [starting] = plays();
  assert.deepEqual(released(), [starting.player]);
  assert.deepEqual(speech.heard, []);

  // Stopped part way, the player is silenced and released at once; no paused
  // pipeline remains loaded until an ended event that will never arrive.
  for (const stop of [() => sounds.stopLine(), () => sounds.setVoices(false)]) {
    sounds.setVoices(true);
    sounds.say(line('grabby_capture_2'));
    await settle();
    const said = plays().at(-1)!;
    stop();
    assert.ok(released().includes(said.player));
    time.elapse();
    assert.ok(released().includes(said.player));
  }
});

test("Thinkle's tutorial lines play from his own clips, and Voices off silences them", async () => {
  resetAudio();
  const sounds = createSounds({ later: () => undefined });
  sounds.say({ id: 'thinkle_tutor_move_opening_1', event: 'move_opening' });
  await settle();
  assert.deepEqual(
    plays().map((entry) => entry.src),
    [
      '/pkg/assets/voices/elevenlabs-dicechess-tutorial-thinkle/thinkle_tutor_move_opening_1.mp3',
    ],
  );
  // Said as it comes, not held for a jingle as a result line is.
  assert.equal(
    speechTiming({ id: 'thinkle_tutor_move_done_1', event: 'move_done' })
      ?.delayMs,
    0,
  );

  resetAudio();
  const voicesOff = createSounds({ voices: false, later: () => undefined });
  voicesOff.say({ id: 'thinkle_tutor_move_opening_1', event: 'move_opening' });
  await settle();
  assert.equal(plays().length, 0);
});

test('setting sound volume applies gain to effect players', async () => {
  resetAudio();
  const time = ends();
  const sounds = createSounds({
    pick: () => 0,
    endClip: time.endClip,
    soundVolume: 0.5,
  });
  await primed(time);
  sounds.play(['piece_move']);
  await settle();
  const [move] = effects();
  assert.equal(move.volume, 0.5);

  sounds.setSoundVolume(0.8);
  assert.equal(
    log()
      .filter(
        (entry) => entry.event === 'volume' && entry.player === move.player,
      )
      .at(-1)?.to,
    0.8,
  );
});

test('setting voice volume applies gain to spoken line player', async () => {
  resetAudio();
  const sounds = createSounds({ later: () => undefined, voiceVolume: 0.7 });
  sounds.say(line('rampage_capture_1'));
  await settle();
  const [said] = plays();
  assert.equal(said.volume, 0.7);

  sounds.setVoiceVolume(0.3);
  assert.equal(
    log()
      .filter(
        (entry) => entry.event === 'volume' && entry.player === said.player,
      )
      .at(-1)?.to,
    0.3,
  );
});

test('an unprimed player starting muted receives soundVolume when unmuted', async () => {
  resetAudio();
  const time = ends();
  const sounds = createSounds({
    pick: () => 0,
    endClip: time.endClip,
    muted: true,
    soundVolume: 0.5,
  });
  await settle();
  sounds.setMuted(false);
  sounds.play(['piece_move']);
  await settle();
  const [move] = effects();
  assert.equal(move.volume, 0.5);
});

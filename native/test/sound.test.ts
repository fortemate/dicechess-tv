import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  audioLog,
  resetAudio,
  failAudio,
  holdAudio,
  releaseAudio,
} from './stubs/react-native-w3cmedia.mjs';
import { createSounds } from '../src/sound';

type Entry = {
  event: string;
  player: number;
  src?: string;
  from?: number;
  contentType?: number;
  usage?: number;
};

const log = () => audioLog as Entry[];
const plays = () => log().filter((entry) => entry.event === 'play');
const settle = () => new Promise((done) => setTimeout(done, 0));

test('three players are made up front, all as game sonification', async () => {
  resetAudio();
  createSounds();
  await settle();
  const created = log().filter((entry) => entry.event === 'create');
  assert.equal(created.length, 3);
  // SONIFICATION/GAME is what connects to the audio service; the music/media
  // defaults were measured not to.
  for (const entry of created) {
    assert.equal(entry.contentType, 4);
    assert.equal(entry.usage, 6);
  }
  assert.equal(log().filter((entry) => entry.event === 'initialize').length, 3);
});

test('a cue plays its file from the package by a plain path', async () => {
  resetAudio();
  const sounds = createSounds({ pick: () => 1 });
  sounds.play(['dice_roll']);
  await settle();
  assert.deepEqual(
    plays().map((entry) => entry.src),
    ['/pkg/assets/sfx/kenney-casino-audio/dice_throw_2.mp3'],
  );
});

test('the same sound again is paused and rewound first, or it would not play', async () => {
  resetAudio();
  const sounds = createSounds({ pick: () => 0 });
  sounds.play(['turn_handoff']);
  await settle();
  sounds.play(['turn_handoff']);
  await settle();
  const handoff = log().filter((entry) => entry.player === plays()[0].player);
  const second = handoff.slice(
    handoff.findIndex((entry) => entry.event === 'play') + 1,
  );
  assert.deepEqual(
    second.map((entry) => entry.event),
    ['pause', 'play'],
  );
  assert.equal(plays()[1].from, 0);
});

test('a capture and the win it causes play together, on different players', async () => {
  resetAudio();
  const sounds = createSounds({ pick: () => 0 });
  sounds.play(['piece_capture', 'game_win']);
  await settle();
  const [capture, win] = plays();
  assert.equal(
    capture.src,
    '/pkg/assets/sfx/jdsherbert-tabletop/piece_impact_1.mp3',
  );
  assert.equal(
    win.src,
    '/pkg/assets/sfx/kenney-music-jingles/pizzicato_02.mp3',
  );
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
    elapse: () => {
      for (const { run } of waiting.splice(0)) run();
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
  assert.deepEqual(
    plays().map((entry) => entry.src),
    ['/pkg/assets/sfx/kenney-casino-audio/dice_throw_1.mp3'],
  );
  assert.deepEqual(time.waits(), [500]);
  time.elapse();
  await settle();
  const [dice, empty] = plays();
  assert.equal(
    empty.src,
    '/pkg/assets/sfx/kenney-interface-sounds/glass_004.mp3',
  );
  // Another player, so the clatter is not paused to make way for it.
  assert.notEqual(dice.player, empty.player);
  assert.equal(
    log().filter(
      (entry) => entry.player === dice.player && entry.event === 'pause',
    ).length,
    0,
  );
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
  assert.deepEqual(
    plays().map((entry) => entry.src),
    [
      '/pkg/assets/sfx/kenney-casino-audio/dice_throw_1.mp3',
      '/pkg/assets/sfx/kenney-music-jingles/pizzicato_01.mp3',
    ],
  );
  // A silent step, such as a new game, drops it as well.
  sounds.play(['dice_roll', 'no_move']);
  sounds.play([]);
  time.elapse();
  await settle();
  assert.equal(
    plays().filter((entry) => entry.src?.endsWith('/glass_004.mp3')).length,
    0,
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
  assert.deepEqual(
    plays().map((entry) => entry.src),
    ['/pkg/assets/sfx/kenney-casino-audio/dice_throw_1.mp3'],
  );
});

test('muted, nothing plays, and what was playing stops', async () => {
  resetAudio();
  const sounds = createSounds({ pick: () => 0 });
  sounds.setMuted(true);
  sounds.play(['dice_roll', 'piece_move', 'game_draw']);
  await settle();
  assert.equal(plays().length, 0);
  assert.equal(log().filter((entry) => entry.event === 'pause').length, 3);
  sounds.setMuted(false);
  sounds.play(['game_draw']);
  await settle();
  assert.equal(plays().length, 1);
});

test('away from the foreground, nothing plays, and the setting is kept', async () => {
  resetAudio();
  const sounds = createSounds({ pick: () => 0 });
  sounds.setSuspended(true);
  sounds.play(['dice_roll', 'piece_move', 'game_draw']);
  await settle();
  assert.equal(plays().length, 0);
  assert.equal(log().filter((entry) => entry.event === 'pause').length, 3);
  // Back in the foreground, sound plays again: it was never muted.
  sounds.setSuspended(false);
  sounds.play(['game_draw']);
  await settle();
  assert.equal(plays().length, 1);
  // And muting still wins over coming back.
  sounds.setMuted(true);
  sounds.setSuspended(false);
  sounds.play(['game_draw']);
  await settle();
  assert.equal(plays().length, 1);
});

test('back before the players are ready, a waiting cue plays to the end', async () => {
  resetAudio();
  holdAudio();
  const sounds = createSounds({ pick: () => 0 });
  sounds.play(['dice_roll']);
  // Away and back while the players are still initialising: the stop asked for
  // on leaving no longer applies once they are ready.
  sounds.setSuspended(true);
  sounds.setSuspended(false);
  releaseAudio();
  await settle();
  const [roll] = plays();
  assert.ok(roll, 'the waiting cue plays');
  const afterwards = log()
    .slice(log().indexOf(roll) + 1)
    .filter((entry) => entry.player === roll.player);
  assert.deepEqual(afterwards, [], 'nothing pauses it');
});

test('a take is chosen among several, and a bad pick cannot fall off the list', async () => {
  resetAudio();
  const picks = [2, 7, -3];
  const sounds = createSounds({ pick: () => picks.shift() ?? 0 });
  sounds.play(['dice_roll']);
  sounds.play(['dice_roll']);
  sounds.play(['dice_roll']);
  await settle();
  assert.deepEqual(
    plays().map((entry) => entry.src?.split('/').pop()),
    ['dice_throw_3.mp3', 'dice_throw_3.mp3', 'dice_throw_1.mp3'],
  );
});

test('a player that never initialises is reported, and nothing is thrown', async () => {
  resetAudio();
  failAudio('initialize');
  const reported: string[] = [];
  const sounds = createSounds({ report: (line) => reported.push(line) });
  sounds.play(['piece_move', 'dice_roll', 'game_win']);
  await settle();
  assert.equal(reported.length, 3, 'one report per channel');
  assert.match(reported[0], /not initialised/);
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
  assert.deepEqual(reported.length, 1);
  assert.match(reported[0], /promotion did not play/);
});

test('a player that refuses to stop is reported, and nothing is thrown', async () => {
  resetAudio();
  failAudio('pause');
  const reported: string[] = [];
  const sounds = createSounds({ report: (line) => reported.push(line) });
  sounds.setSuspended(true);
  await settle();
  assert.deepEqual(reported, [
    'sound: board did not stop: Error: not supported',
    'sound: dice did not stop: Error: not supported',
    'sound: result did not stop: Error: not supported',
  ]);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  audioLog,
  resetAudio,
  failAudio,
  holdAudio,
  releaseAudio,
} from './stubs/react-native-w3cmedia.mjs';
import {
  createSounds,
  LINE_TAIL_MS,
  RESULT_LINE_DELAY_MS,
  speechTiming,
} from '../src/sound';
import { VOICE_FILES } from '../src/voiceFiles';

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

test('four players are made up front, all as game sonification', async () => {
  resetAudio();
  createSounds();
  await settle();
  const created = log().filter((entry) => entry.event === 'create');
  // Three for the cues, one for the bots' voices.
  assert.equal(created.length, 4);
  // SONIFICATION/GAME is what connects to the audio service; the music/media
  // defaults were measured not to.
  for (const entry of created) {
    assert.equal(entry.contentType, 4);
    assert.equal(entry.usage, 6);
  }
  assert.equal(log().filter((entry) => entry.event === 'initialize').length, 4);
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
  // The voice stops too.
  assert.equal(log().filter((entry) => entry.event === 'pause').length, 4);
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

test('a cue waiting for initialization is dropped across suspension, even after a quick return', async () => {
  resetAudio();
  holdAudio();
  const sounds = createSounds({ pick: () => 0 });
  sounds.play(['dice_roll']);
  // Away and back while the players are still initialising: an old cue must
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

test('a quick blur/focus still pauses an already playing effect and line', async () => {
  resetAudio();
  const sounds = createSounds({ pick: () => 0 });
  sounds.play(['dice_roll']);
  sounds.say({ id: 'host_intro_1', event: 'intro' });
  await settle();
  const [roll, said] = plays();
  assert.match(roll.src ?? '', /dice_throw_1\.mp3$/);
  assert.match(said.src ?? '', /host_intro_1\.mp3$/);
  const before = log().length;
  // Focus is back before a promise callback could run: the pause must already
  // have reached the players that are making sound.
  sounds.setSuspended(true);
  sounds.setSuspended(false);
  const paused = log()
    .slice(before)
    .filter((entry) => entry.event === 'pause')
    .map((entry) => entry.player);
  assert.ok(paused.includes(roll.player), 'the dice stop');
  assert.ok(paused.includes(said.player), 'the line stops');
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
  assert.equal(reported.length, 4, 'one report per player');
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
    'sound: voice did not stop: Error: not supported',
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
  // It counts as said a little after the clip ends.
  assert.deepEqual(time.waits(), [
    Math.round(VOICE_FILES.grabby_capture_1.seconds * 1000) + LINE_TAIL_MS,
  ]);
  time.elapse();
  assert.deepEqual(speech.heard, [true, false]);
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
  assert.equal(log().filter((entry) => entry.event === 'pause').length, 0);
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
  const voice = plays()[0].player;
  assert.deepEqual(
    log()
      .filter((entry) => entry.player === voice && entry.event !== 'src')
      .map((entry) => entry.event),
    ['create', 'initialize', 'play', 'pause', 'play'],
  );
  assert.equal(plays()[1].src?.split('/').pop(), 'rampage_capture_heavy_2.mp3');
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
  later.elapse();
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
  // A colourless win line picked for White's win still has the event 'win'.
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
  assert.equal(log().at(-1)?.event, 'pause');
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
  assert.equal(log().at(-1)?.event, 'pause');
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
  assert.deepEqual(
    plays().map((entry) => entry.src?.split('/').pop()),
    ['dice_throw_1.mp3'],
  );
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
  assert.deepEqual(reported, [
    'sound: line nobody_capture_1 has no clip',
    'sound: line rolly_capture_3 did not play: Error: not supported',
  ]);
  assert.deepEqual(speech.heard, []);
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

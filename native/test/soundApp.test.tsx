// Sound through the whole app: a step of a real game reaches the players, and
// turning sound off survives a relaunch. A test cannot hear, so what is checked
// is what was asked for; hearing it is checked on the virtual device.
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { act } from 'react-test-renderer';
import { appEvent, setAppState } from './stubs/react-native-kepler.mjs';
import { audioLog, resetAudio } from './stubs/react-native-w3cmedia.mjs';
import {
  fullyDrawnReports,
  resetFullyDrawnReports,
} from './stubs/kepler-performance-api.mjs';
import { MMKV, reset } from './stubs/react-native-mmkv.mjs';
import { EFFECTS_RETURN_MS, type Sounds } from '../src/sound';
import { lateSounds } from '../src/lateAudio';
import type { Cue } from '../../src/core/cues';
import { MmkvSnapshotStore } from '../src/mmkvStore';
import { decodeGame, newGame, rollGame, type Game } from '../../src/core/game';
import { HOST_CATALOGUE } from '../../src/core/hostVoice';
import { soundGain } from '../src/soundSetting';
import { voiceGain } from '../src/voiceSetting';
import {
  fakeTimers,
  fixedOptions,
  launch,
  send,
  text,
  unmount,
  type Instance,
} from './support';

// The music and the voices run on the test's clock.
fakeTimers();

const options = fixedOptions({ roll: () => [2, 2, 2] });

type Recorder = Sounds & {
  played: Cue[][];
  muted: boolean | null;
  soundVolume: number | null;
  suspended: boolean | null;
  said: string[];
  // How many times a line was stopped on its own (#202).
  stopped: number;
  voices: boolean | null;
  voiceVolume: number | null;
};

const recorder = (): Recorder => {
  const self: Recorder = {
    played: [],
    muted: null,
    soundVolume: null,
    suspended: null,
    said: [],
    stopped: 0,
    voices: null,
    voiceVolume: null,
    play(cues) {
      if (cues.length) self.played.push([...cues]);
    },
    setMuted(value) {
      self.muted = value;
    },
    setSoundVolume(gain) {
      self.soundVolume = gain;
    },
    say(line) {
      self.said.push(line.id);
    },
    stopLine() {
      self.stopped++;
    },
    setVoices(on) {
      self.voices = on;
    },
    setVoiceVolume(gain) {
      self.voiceVolume = gain;
    },
    setSuspended(value) {
      self.suspended = value;
    },
    dispose() {},
  };
  return self;
};

// Elements drawn with a testID, counted once: the stubs pass it on to the host
// element they render.
const drawn = (root: Instance, id: string) =>
  root.findAll(
    (node) => typeof node.type === 'string' && node.props?.testID === id,
  );

test('a real game step reaches the sounds as the cue it is', () => {
  reset();
  const sounds = recorder();
  launch({ options, sounds });
  // Start a hotseat game, then roll.
  send('enter', 'enter');
  assert.deepEqual(sounds.played, [['dice_roll']]);
});

test('turning sound off is remembered at the next launch', () => {
  reset();
  const first = recorder();
  let root = launch({ options, sounds: first }).root;
  assert.equal(first.muted, false, 'sound starts on');

  // Home, nothing saved: new hotseat, Play the computer, Learn to play, Rules reference,
  // Settings. This build has no music, so the sound effects come first.
  send('down', 'down', 'down', 'down', 'enter');
  assert.match(text(root), /Sounds: 10/);
  send('enter');
  assert.match(text(root), /Sounds: off/);
  assert.equal(first.muted, true);

  const second = recorder();
  root = launch({ options, sounds: second }).root;
  assert.equal(second.muted, true, 'a relaunch starts muted');
  send('down', 'down', 'down', 'down', 'enter');
  assert.match(text(root), /Sounds: off/);
  send('enter');
  assert.match(text(root), /Sounds: 10/);
  assert.equal(second.muted, false);
});

test('stepping the sound volume adjusts gain and persists across launches (#398)', () => {
  reset();
  const first = recorder();
  let root = launch({ options, sounds: first }).root;
  send('down', 'down', 'down', 'down', 'enter');
  assert.match(text(root), /Sounds: 10/);
  send('left', 'left');
  assert.match(text(root), /Sounds: 8/);
  assert.equal(new MMKV().getString('dicechess-tv.soundVolume.v1'), '8');
  assert.equal(first.soundVolume, soundGain(8));

  const second = recorder();
  root = launch({ options, sounds: second }).root;
  assert.equal(second.soundVolume, soundGain(8));
  send('down', 'down', 'down', 'down', 'enter');
  assert.match(text(root), /Sounds: 8/);
});

test('the bots speak by default, and turning their voices off is remembered (#159, #398)', () => {
  reset();
  const first = recorder();
  let root = launch({ options, sounds: first }).root;
  assert.equal(first.voices, true, 'voices start on');
  // Settings, then the row after the sound effects.
  send('down', 'down', 'down', 'down', 'enter');
  assert.match(text(root), /Voices: 10/);
  send('down', 'enter');
  assert.match(text(root), /Voices: off/);
  assert.equal(first.voices, false);
  assert.equal(first.muted, false, 'the effects are left alone');

  const second = recorder();
  root = launch({ options, sounds: second }).root;
  assert.equal(second.voices, false, 'a relaunch starts without voices');
  send('down', 'down', 'down', 'down', 'enter');
  send('down');
  assert.match(text(root), /Voices: off/);
  send('enter');
  assert.match(text(root), /Voices: 10/);
  assert.equal(second.voices, true);
});

test('stepping the voices volume adjusts gain and persists across launches (#398)', () => {
  reset();
  const first = recorder();
  let root = launch({ options, sounds: first }).root;
  send('down', 'down', 'down', 'down', 'enter');
  send('down');
  assert.match(text(root), /Voices: 10/);
  send('left');
  assert.match(text(root), /Voices: 9/);
  assert.equal(new MMKV().getString('dicechess-tv.voiceVolume.v1'), '9');
  assert.equal(first.voiceVolume, voiceGain(9));

  const second = recorder();
  root = launch({ options, sounds: second }).root;
  assert.equal(second.voiceVolume, voiceGain(9));
  send('down', 'down', 'down', 'down', 'enter');
  send('down');
  assert.match(text(root), /Voices: 9/);
});

test('Prowla hosts Hot Seat by default, Rolly, Thinkle or no one instead, and the choice is remembered (#202, #258, #279)', () => {
  reset();
  const first = recorder();
  let root = launch({ options, sounds: first }).root;
  // Settings, then Up wraps to the host's row at the end.
  send('down', 'down', 'down', 'down', 'enter');
  assert.match(text(root), /Host for friends: Prowla/);
  send('up', 'enter');
  assert.match(text(root), /Host for friends: Rolly/);
  assert.equal(new MMKV().getString('dicechess-tv.host.v1'), 'rolly');
  send('enter');
  assert.match(text(root), /Host for friends: Thinkle/);
  assert.equal(new MMKV().getString('dicechess-tv.host.v1'), 'thinkle');
  send('enter');
  assert.match(text(root), /Host for friends: off/);
  assert.match(text(root), /Voices: 10/, 'the voices are left alone');
  assert.equal(first.voices, true);
  // Stored as the choice itself, which a later host's id would replace.
  assert.equal(new MMKV().getString('dicechess-tv.host.v1'), 'off');

  const second = recorder();
  root = launch({ options, sounds: second }).root;
  send('down', 'down', 'down', 'down', 'enter');
  assert.match(text(root), /Host for friends: off/);
  // Back to the home screen, up to a new hotseat game: she says nothing.
  send('back', 'up', 'up', 'up', 'up', 'enter');
  assert.match(text(root), /FRIEND GAME · TURN 1/);
  assert.deepEqual(second.said, []);
});

test('turning the host off while she speaks stops her voice, and only hers (#202)', () => {
  reset();
  const sounds = recorder();
  let root = launch({ options, sounds: sounds }).root;
  // A new hotseat game: she greets both players.
  send('enter');
  assert.match(sounds.said[0], /^prowla_host_intro_[1-5]$/);
  // The game menu, up to its Settings, and Up to her last row.
  send('back', 'up', 'enter', 'up');
  assert.match(text(root), /Host for friends: Prowla/);
  assert.equal(sounds.stopped, 0, 'a menu alone leaves the line alone');
  // Another host lets the line being said finish (#258), and so does a third.
  send('enter');
  assert.match(text(root), /Host for friends: Rolly/);
  assert.equal(sounds.stopped, 0);
  send('enter');
  assert.match(text(root), /Host for friends: Thinkle/);
  assert.equal(sounds.stopped, 0);
  send('enter');
  assert.match(text(root), /Host for friends: off/);
  assert.equal(sounds.stopped, 1);
  assert.equal(sounds.voices, true, 'the Voices setting is left alone');

  // Against the computer the line is the bot's, which the host's setting
  // never stops.
  reset();
  const bot = recorder();
  root = launch({ options, sounds: bot }).root;
  // Play the computer, then Rolly: Play as is Random (#345).
  send('down', 'enter', 'enter');
  assert.match(bot.said[0], /^rolly_intro_[123]$/);
  send('back', 'up', 'enter', 'up', 'enter', 'enter', 'enter');
  assert.match(text(root), /Host for friends: off/);
  assert.equal(bot.stopped, 0);
});

test('a fresh launch says nothing behind the home screen (#202)', () => {
  const store = new MmkvSnapshotStore<Game>({
    key: 'dicechess-tv.game.v2',
    decode: decodeGame,
  });
  for (const saved of [
    null,
    newGame('hotseat', 'unstarted'),
    // A game against the bot that was never rolled: it used to greet the
    // home screen.
    newGame('random', 'unrolled'),
  ]) {
    reset();
    if (saved) store.save(saved);
    const sounds = recorder();
    const { root } = launch({ options, sounds });
    assert.match(text(root), /Dice Chess/);
    assert.deepEqual(sounds.said, [], saved?.id ?? 'nothing saved');
  }
});

test('a new hotseat game opens with the host greeting both players (#202)', () => {
  reset();
  const sounds = recorder();
  launch({ options, sounds });
  send('enter');
  assert.equal(sounds.said.length, 1);
  assert.match(sounds.said[0], /^prowla_host_intro_[1-5]$/);
});

test('the Hot Seat host is seen while she speaks, above the bottom badge, and nothing else moves (#213)', () => {
  reset();
  const sounds = recorder();
  const { root } = launch({ options, sounds });
  const textOf = (id: string) =>
    HOST_CATALOGUE.find((line) => line.id === id)?.text;
  // Her portrait and her line stand in the free space above the bottom
  // badge, placed over it rather than in the flow, so the dice and the
  // prompt keep their place; the turn line stands where it always does.
  const speaking = (id: string, turn: RegExp) => {
    const [block] = drawn(root, 'host-block');
    assert.ok(block, 'she shows while she speaks');
    assert.equal(block.props.style.position, 'absolute');
    assert.equal(drawn(block, 'portrait-cat').length, 1);
    assert.equal(text(block), textOf(id));
    const [line] = drawn(root, 'turn-line');
    assert.match(text(line), turn);
  };
  // A new hotseat game: she greets both players.
  send('enter');
  assert.equal(sounds.said.length, 1);
  assert.match(sounds.said[0], /^prowla_host_intro_[1-5]$/);
  speaking(sounds.said[0], /FRIEND GAME · TURN 1/);
  // Her greeting said, she leaves the screen; the turn line stays.
  act(() => {
    mock.timers.tick(10_000);
  });
  assert.equal(drawn(root, 'host-block').length, 0);
  assert.match(text(drawn(root, 'turn-line')[0]), /FRIEND GAME · TURN 1/);
  // White rolls and resigns: her last word shows with the result, and holds.
  send('enter', 'back', 'down', 'select', 'down', 'select');
  assert.match(text(root), /Black wins/);
  assert.equal(sounds.said.length, 2);
  assert.match(sounds.said[1], /^prowla_host_(black_wins|win)_\d$/);
  speaking(sounds.said[1], /FRIEND GAME · TURN 1/);
  act(() => {
    mock.timers.tick(10_000);
  });
  speaking(sounds.said[1], /FRIEND GAME · TURN 1/);
});

test('Rolly, chosen, hosts in her own voice, and her portrait shows with her line (#258)', () => {
  reset();
  new MMKV().set('dicechess-tv.host.v1', 'rolly');
  const sounds = recorder();
  const { root } = launch({ options, sounds });
  send('enter');
  assert.equal(sounds.said.length, 1);
  assert.match(sounds.said[0], /^host_intro_[1-5]$/);
  const [block] = drawn(root, 'host-block');
  assert.ok(block, 'she shows while she speaks');
  assert.equal(drawn(block, 'portrait-rolly').length, 1);
  assert.equal(drawn(block, 'portrait-cat').length, 0);
  assert.equal(
    text(block),
    HOST_CATALOGUE.find((line) => line.id === sounds.said[0])?.text,
  );
});

// Each recorded greeting reaches the voice player by its original id, while
// the bubble uses U.S. spelling. In particular, the first clip's pinned
// transcript uses a British spelling that must not be the caption expectation.
for (const [index, caption] of [
  'Hmm... the dice favor no one, young or old.',
  'Settle in, my friends. A new tale begins.',
  'White, you roll first. The stars are watching!',
  'Welcome, you two! May the best roll win.',
  'I promise: no spells from me, only dice!',
].entries()) {
  test(`Thinkle, chosen, hosts greeting ${index + 1} in his own voice with a U.S. caption (#279)`, (t) => {
    // Leave shuffle slots in place until this greeting can swap to the front.
    let slot = 4;
    t.mock.method(Math, 'random', () => (slot-- === index ? 0 : 0.999));
    reset();
    new MMKV().set('dicechess-tv.host.v1', 'thinkle');
    const sounds = recorder();
    const { root } = launch({ options, sounds });
    send('enter');
    assert.deepEqual(sounds.said, [`thinkle_host_intro_${index + 1}`]);
    const [block] = drawn(root, 'host-block');
    assert.ok(block, 'he shows while he speaks');
    assert.equal(drawn(block, 'portrait-thinkle').length, 1);
    assert.equal(drawn(block, 'portrait-cat').length, 0);
    assert.equal(text(block), caption);
  });
}

test('a line the bot says is handed to the voice', () => {
  reset();
  const sounds = recorder();
  launch({ options, sounds });
  // Play the computer, Rolly, on Random: the game opens with Rolly's intro.
  send('down', 'enter', 'enter', 'enter');
  assert.equal(sounds.said.length, 1);
  assert.match(sounds.said[0], /^rolly_intro_[123]$/);
});

test('a win as Black is heard as a win', () => {
  reset();
  // Saved mid-turn: the person plays Black, rolled three rooks, and the rook on
  // a1 can take the White king on a8.
  const saved = rollGame(
    newGame('random', 'asblack', 'K7/8/8/8/8/8/8/r3k3 b - - 0 1', 'b'),
    [4, 4, 4],
  );
  new MmkvSnapshotStore<Game>({
    key: 'dicechess-tv.game.v2',
    decode: decodeGame,
  }).save(saved);
  const sounds = recorder();
  launch({ options, sounds });
  // Resume, then walk from e7 to a1 and on to a8 on the board seen from
  // Black's side, where up on the screen is towards rank 1.
  send('enter');
  send('up', 'up', 'up', 'up', 'up', 'up', 'right', 'right', 'right', 'right');
  send('enter');
  send('down', 'down', 'down', 'down', 'down', 'down', 'down');
  send('enter');
  assert.deepEqual(sounds.played.at(-1), ['piece_capture', 'game_win']);
});

test('leaving the foreground stops the sound, and coming back is a warm start', () => {
  reset();
  resetFullyDrawnReports();
  const sounds = recorder();
  launch({ options, sounds });
  // The cool start is fully drawn by the first render.
  assert.equal(fullyDrawnReports(), 1);

  act(() => setAppState('background'));
  assert.equal(sounds.suspended, true);
  act(() => setAppState('active'));
  assert.equal(sounds.suspended, false);
  assert.equal(fullyDrawnReports(), 2);

  // The screensaver or a system dialog leaves the app inactive: silent too.
  act(() => setAppState('inactive'));
  assert.equal(sounds.suspended, true);
  act(() => setAppState('active'));
  assert.equal(fullyDrawnReports(), 3);

  // Active again without having been away is not another start.
  act(() => setAppState('active'));
  assert.equal(fullyDrawnReports(), 3);
});

// The effects' players through the whole app (#313): on a Fire TV Stick the
// system ends an app in the background that holds on to its memory, and a
// loaded player holds memory and processor time even paused.
type AudioEntry = {
  event: string;
  player: number;
  src?: string;
  volume?: number;
};
const audio = () => audioLog as AudioEntry[];
const spritePlayers = () =>
  audio()
    .filter(
      (entry) => entry.event === 'src' && entry.src?.endsWith('effects.mp3'),
    )
    .map((entry) => entry.player);
const releasedPlayers = () =>
  audio()
    .filter((entry) => entry.event === 'deinitialize')
    .map((entry) => entry.player);
const settled = () => act(async () => {});

test('the effects’ players are let go when the app leaves, made again after the return, and let go when it closes (#313)', async () => {
  reset();
  resetAudio();
  launch({ options });
  await settled();
  const first = spritePlayers();
  assert.equal(first.length, 3);
  // Home: Vega sends blur, then the change to the background.
  const before = audio().length;
  act(() => appEvent('blur'));
  act(() => setAppState('background'));
  assert.deepEqual(releasedPlayers().sort(), [...first].sort());
  assert.equal(
    audio()
      .slice(before)
      .filter((entry) => entry.event === 'pause').length,
    0,
    'let go without a pause first (#386)',
  );
  // Back from the launcher: on a Stick, focus alone.
  act(() => appEvent('focus'));
  await settled();
  assert.deepEqual(spritePlayers(), first, 'not in the moment of the return');
  act(() => mock.timers.tick(EFFECTS_RETURN_MS));
  await settled();
  const second = spritePlayers().filter((player) => !first.includes(player));
  assert.equal(second.length, 3);
  // A new friend game, and its first roll is heard on the new players.
  send('enter');
  await settled();
  send('enter');
  await settled();
  const heard = audio().filter(
    (entry) =>
      entry.event === 'play' &&
      entry.volume !== 0 &&
      second.includes(entry.player),
  );
  assert.ok(heard.length > 0, 'the roll is heard');
  // Closing the app lets them go.
  unmount();
  assert.ok(second.every((player) => releasedPlayers().includes(player)));
});

test('a launch while the app is away makes no effects player until the return (#478)', async () => {
  reset();
  resetAudio();
  setAppState('background');
  launch({ options });
  await settled();
  assert.deepEqual(spritePlayers(), [], 'nothing loaded while away');
  assert.deepEqual(releasedPlayers(), [], 'nothing made only to be let go');
  act(() => setAppState('active'));
  act(() => mock.timers.tick(EFFECTS_RETURN_MS));
  await settled();
  assert.equal(spritePlayers().length, 3);
});

test('settings told before the sounds exist reach them once made; a cue before then is not heard (#313)', () => {
  const late = lateSounds();
  late.setMuted(true);
  late.setSoundVolume(0.3);
  late.setVoices(false);
  late.setVoiceVolume(0.6);
  late.setSuspended(true);
  late.play(['dice_roll']);
  late.say({ id: 'host_intro_1', event: 'intro' });
  const real = recorder();
  late.attach(real);
  assert.deepEqual(real.played, []);
  assert.deepEqual(real.said, []);
  assert.equal(real.muted, true);
  assert.equal(real.soundVolume, 0.3);
  assert.equal(real.voices, false);
  assert.equal(real.voiceVolume, 0.6);
  assert.equal(real.suspended, true);
  late.setSuspended(false);
  late.play(['dice_roll']);
  assert.equal(real.suspended, false);
  assert.deepEqual(real.played, [['dice_roll']]);
});

test('the current first-frame line reaches the player once, and is not replayed on reattachment', () => {
  const late = lateSounds();
  late.say({ id: 'thinkle_tutor_offer_1', event: 'offer' });
  late.say({ id: 'thinkle_tutor_offer_2', event: 'offer' });
  const first = recorder();
  late.attach(first);
  assert.deepEqual(first.said, ['thinkle_tutor_offer_2']);
  late.attach(null);
  const next = recorder();
  late.attach(next);
  assert.deepEqual(next.said, []);
});

for (const cancel of ['stop', 'dispose', 'voices off', 'suspend']) {
  test(`${cancel} cancels a first-frame line before the player is attached`, () => {
    const late = lateSounds();
    late.say({ id: 'thinkle_tutor_offer_1', event: 'offer' });
    if (cancel === 'stop') late.stopLine();
    else if (cancel === 'dispose') late.dispose();
    else if (cancel === 'voices off') late.setVoices(false);
    else late.setSuspended(true);
    const real = recorder();
    late.attach(real);
    assert.deepEqual(real.said, []);
  });
}

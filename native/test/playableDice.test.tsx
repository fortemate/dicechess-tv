// A die no legal turn can spend dims as soon as that is known, through the
// whole app (#140): at a person's roll and after their action, and at the
// opponent's roll, before it plays. Steps the app schedules wait in a queue
// here, so a test can look at the screen between the opponent's steps.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { act } from 'react-test-renderer';
import { reset } from './stubs/react-native-mmkv.mjs';
import { BOT_STEP_MS, type ScreenOptions } from '../src/screen';
import { THEME } from '../src/theme';
import {
  fakeTimers,
  fixedOptions,
  isHost,
  launch,
  send,
  silentSounds,
  styleOf,
  text,
  type Instance,
} from './support';

// The voices and the music run on the test's clock.
fakeTimers();

const scheduler = () => {
  const queue: { step: () => void; wait: number }[] = [];
  return {
    schedule: (step: () => void, wait: number) => {
      queue.push({ step, wait });
    },
    waits: () => queue.map(({ wait }) => wait),
    // Runs what waits now; what those steps schedule in turn waits for the next
    // call.
    next: () => {
      for (const { step } of queue.splice(0)) act(() => step());
    },
  };
};

// Every roll is queen, rook and knight. From the opening only a knight can move
// first, a rook can follow it, and the queen die is lost.
const optionsFor = (
  clock: ReturnType<typeof scheduler>,
  side: 'w' | 'b',
): ScreenOptions =>
  fixedOptions({ schedule: clock.schedule, side: () => side });

// Each die in roll order, as the screen draws it: lit, with its ring; dim,
// without the ring but at full size and at 45 %; or spent, at 30 % and smaller.
const looks = (root: Instance): string[] =>
  root
    .findAll(
      (node) =>
        isHost(node, 'View') && styleOf(node).backgroundColor === THEME.die,
    )
    .map((node) => {
      const die = styleOf(node);
      if (die.opacity === 0.3 && (die.width as number) < 72) return 'spent';
      if (die.opacity === 0.45 && die.borderWidth === 0 && die.width === 72)
        return 'dim';
      if (die.opacity === 1 && (die.borderWidth as number) > 0) return 'lit';
      return JSON.stringify(die);
    });

test('on a person’s roll the lost die dims at once and stays dim after an action', () => {
  reset();
  const { root, state } = launch({
    options: optionsFor(scheduler(), 'w'),
    sounds: silentSounds(),
  });
  // A new hotseat game, then the roll.
  send('enter', 'enter');
  assert.match(state(), /dice "QRN" \| playable "RN"/);
  assert.deepEqual(looks(root), ['dim', 'lit', 'lit']);
  // Left to the b1 knight, OK picks it up and lands on a3, and OK plays it.
  send('left', 'enter', 'enter');
  assert.match(state(), /dice "QR" \| playable "R"/);
  assert.match(state(), /last b1a3/);
  assert.deepEqual(looks(root), ['dim', 'lit', 'spent']);
});

test('on the opponent’s roll the lost die dims before it plays', () => {
  reset();
  const clock = scheduler();
  const { root } = launch({
    options: optionsFor(clock, 'b'),
    sounds: silentSounds(),
  });
  // Play the computer, Rolly, on Random, which draws Black: the computer opens.
  send('down', 'enter', 'enter', 'enter');
  assert.deepEqual(clock.waits(), [BOT_STEP_MS]);
  clock.next();
  assert.match(text(root), /Rolly is playing/);
  assert.deepEqual(looks(root), ['dim', 'lit', 'lit']);
  // Its first action is a knight, whichever it picks, and the queen stays dim.
  clock.next();
  assert.deepEqual(looks(root), ['dim', 'lit', 'spent']);
});

// What the panel says during play, through the whole app: that a turn is over
// at the handoff and whose turn OK starts (#232), and which piece is in hand
// rather than its square, which the board does not label (#233), each on one
// line (#240).
//
// The headline and the prompt are read by their sizes, the panel's one 38 dp
// line and its one 24 dp line, so a host's or a bot's line beside them is never
// taken for either.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { act } from 'react-test-renderer';
import { MMKV, reset } from './stubs/react-native-mmkv.mjs';
import { Dice } from '../src/Dice';
import { THEME } from '../src/theme';
import { PIECES } from '../src/pieces';
import type { ScreenOptions } from '../src/screen';
import {
  fakeTimers,
  fixedOptions,
  isHost,
  launch,
  send,
  styleOf,
  text,
  type Instance,
} from './support';

// The bot's and the host's lines go on the voices' own timers.
fakeTimers();

// Steps the app schedules wait in a queue here, so a test can look at the
// screen between the opponent's steps.
const scheduler = () => {
  const queue: (() => void)[] = [];
  return {
    schedule: (step: () => void) => {
      queue.push(step);
    },
    // Runs what waits now; what those steps schedule waits for the next call.
    next: () => {
      for (const step of queue.splice(0)) act(() => step());
    },
  };
};

// Every roll is the same one, and Random draws White.
const optionsFor = (roll: number[], clock = scheduler()): ScreenOptions =>
  fixedOptions({ roll: () => [...roll], schedule: clock.schedule });

const linesAt = (root: Instance, size: number): string[] =>
  root
    .findAll(
      (node) => isHost(node, 'Text') && styleOf(node).fontSize === size,
      { deep: true },
    )
    .map((node) => String(node.props.children));

const only = (lines: string[]): string => {
  assert.equal(lines.length, 1, lines.join(' | '));
  return lines[0];
};
const headline = (root: Instance) => only(linesAt(root, 38));
const prompt = (root: Instance) => only(linesAt(root, 24));

// What the bot's badge says it is doing, if anything (#168).
const botStatus = (root: Instance): string | null => {
  const found = root.findAll(
    (node) =>
      typeof node.type === 'string' && node.props?.testID === 'bot-status',
  );
  return found.length ? String(found[0].props.children) : null;
};

test('a Hot Seat turn with a die left over says it is over, and whose turn OK starts', () => {
  reset();
  const { root } = launch({ options: optionsFor([2, 6, 6]) });
  // A new hotseat game and knight, king, king: only a knight can move. OK
  // picks it up and lands on a square, OK plays it, and neither king can use
  // its die.
  send('enter', 'enter', 'enter', 'enter');
  assert.equal(headline(root), "White's turn is over");
  assert.equal(prompt(root), "OK: Black's turn");
  // OK starts Black's turn and rolls the dice.
  send('enter');
  assert.equal(headline(root), 'Black to play');
  assert.equal(prompt(root), 'OK: pick up · Back: menu');
  // Black's knight the same way, and then White's turn is the next.
  send('enter', 'enter');
  assert.equal(headline(root), "Black's turn is over");
  assert.equal(prompt(root), "OK: White's turn");
});

test('a turn that spends all three dice is over in the same words', () => {
  reset();
  const { root, state } = launch({ options: optionsFor([1, 1, 1]) });
  // A new hotseat game and three pawns, which can always all be spent: OK
  // picks a pawn up, OK plays it.
  send('enter', 'enter', 'enter', 'enter', 'enter', 'enter');
  assert.match(state(), /phase move/);
  assert.equal(headline(root), 'White to play', 'a die is still to play');
  send('enter', 'enter');
  assert.match(state(), /phase handoff \| side w \| dice ""/);
  assert.equal(headline(root), "White's turn is over");
  assert.equal(prompt(root), "OK: Black's turn");
});

test('against the bot the person’s turn is over and OK starts the bot’s, which ends the same way', () => {
  reset();
  const clock = scheduler();
  const { root } = launch({ options: optionsFor([2, 6, 6], clock) });
  // Play the computer, Rolly, on Random, which draws White; roll, and play
  // the knight.
  send('down', 'enter', 'enter', 'enter', 'enter', 'enter', 'enter');
  assert.equal(headline(root), 'Your turn is over');
  assert.equal(prompt(root), "OK: Rolly's turn");
  assert.doesNotMatch(text(root), /to play/);

  // OK hands the turn over. Rolly rolls, and plays on until its knight has
  // moved.
  send('enter');
  clock.next();
  assert.equal(prompt(root), 'Rolly is playing…');
  assert.equal(botStatus(root), 'Thinking…');
  clock.next();
  // Its turn is over too while its last move is seen: it no longer plays or
  // thinks, and the person's turn is next.
  assert.equal(headline(root), "Black's turn is over");
  assert.equal(prompt(root), 'Your turn next');
  assert.equal(botStatus(root), null);
  clock.next();
  assert.equal(headline(root), 'White to play · you');
  assert.equal(prompt(root), 'OK: roll three dice');

  // Before the person rolls, Rolly's played dice stay dimmed on screen (#297)
  const dice = root.findByType(Dice);
  const faces = dice.findAll(
    (node) =>
      isHost(node, 'View') && styleOf(node).backgroundColor === THEME.die,
  );
  assert.equal(faces.length, 3);
  assert.equal(dice.findAllByType(PIECES.n as never).length, 1);
  assert.equal(dice.findAllByType(PIECES.k as never).length, 2);
  assert.ok(
    faces.every(
      (node) =>
        node.props.style?.opacity === 0.3 || node.props.style?.opacity === 0.45,
    ),
  );

  // Pressing OK rolls the person's dice, replacing Rolly's dimmed dice
  send('enter');
  assert.equal(headline(root), 'White to play · you');
  assert.equal(prompt(root), 'OK: pick up · Back: menu');
  assert.equal(dice.findAllByType(PIECES.N as never).length, 1);
  assert.equal(dice.findAllByType(PIECES.K as never).length, 2);
});

test('a piece in hand is named, not its square, which the board does not label', () => {
  reset();
  const { root, state } = launch({ options: optionsFor([5, 4, 2]) });
  // A new hotseat game and queen, rook, knight: only a knight can move. OK
  // picks it up.
  send('enter', 'enter', 'enter');
  assert.match(state(), /selected g1/);
  assert.equal(prompt(root), 'OK: move the knight here');
  assert.doesNotMatch(text(root), /\b[a-h][1-8]\b/);
  // Back puts it down, and the prompt is the board's again (#240).
  send('back');
  assert.match(state(), /selected -/);
  assert.equal(prompt(root), 'OK: pick up · Back: menu');
});

test('Black’s piece is named too, on the board turned for Black', () => {
  reset();
  new MMKV().set('dicechess-tv.turnBoard.v1', 'on');
  const { root, state } = launch({ options: optionsFor([1, 1, 1]) });
  // A new hotseat game: White plays three pawns, and OK hands the turn over and rolls for Black.
  send('enter', 'enter', 'enter', 'enter', 'enter', 'enter', 'enter', 'enter');
  send('enter');
  // Black picks a pawn up, on the board turned for Black.
  send('enter');
  assert.match(state(), /side b/);
  assert.match(state(), /selected [a-h]7/);
  assert.equal(prompt(root), 'OK: move the pawn here');
  assert.doesNotMatch(text(root), /\b[a-h][1-8]\b/);
});

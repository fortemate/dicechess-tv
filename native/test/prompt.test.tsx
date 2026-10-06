// What the panel says during play, through the whole app: that a turn is over
// at the handoff and whose turn OK starts (#232), and which piece is in hand
// rather than its square, which the board does not label (#233), each on one
// line (#240).
//
// The headline and the prompt are read by their sizes, the panel's one 38 dp
// line and its one 24 dp line, so a host's or a bot's line beside them is never
// taken for either.
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { press, pressBack } from './stubs/react-native-kepler.mjs';
import { MMKV, reset } from './stubs/react-native-mmkv.mjs';
import { App } from '../src/App';
import type { ScreenOptions } from '../src/screen';

type Instance = renderer.ReactTestInstance;
type Style = Record<string, string | number | undefined>;

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

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
const optionsFor = (roll: number[], clock = scheduler()): ScreenOptions => ({
  roll: () => [...roll],
  newId: () => 'prompt',
  schedule: clock.schedule,
  side: () => 'w',
});

// A launch replaces the app a previous test left mounted, as a relaunch does.
// The screen's own report of its state comes with it.
let mounted: renderer.ReactTestRenderer | null = null;
const launch = (options: ScreenOptions) => {
  if (mounted) act(() => mounted!.unmount());
  const reports: string[] = [];
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(
      React.createElement(App, {
        options,
        onState: (line: string) => reports.push(line),
      }),
    );
  });
  mounted = tree;
  return {
    root: tree.root,
    state: () => reports.filter((line) => line.startsWith('overlay')).at(-1),
  };
};

// Back arrives on its own channel on Vega, as in the other screen tests.
const send = (...keys: string[]) => {
  for (const key of keys)
    act(() => {
      if (key === 'back') pressBack();
      else press(key);
    });
};

const linesAt = (root: Instance, size: number): string[] =>
  root
    .findAll(
      (node) =>
        (node.type as unknown as string) === 'Text' &&
        (node.props.style as Style | undefined)?.fontSize === size,
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

// Every line on the screen, as a viewer reads it.
const text = (root: Instance) =>
  root
    .findAll((node) => (node.type as unknown as string) === 'Text', {
      deep: true,
    })
    .map((node) => String(node.props.children))
    .join('\n');

test('a Hot Seat turn with a die left over says it is over, and whose turn OK starts', () => {
  reset();
  const { root } = launch(optionsFor([2, 6, 6]));
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
  const { root, state } = launch(optionsFor([1, 1, 1]));
  // A new hotseat game and three pawns, which can always all be spent: OK
  // picks a pawn up, OK plays it.
  send('enter', 'enter', 'enter', 'enter', 'enter', 'enter');
  assert.match(state() ?? '', /phase move/);
  assert.equal(headline(root), 'White to play', 'a die is still to play');
  send('enter', 'enter');
  assert.match(state() ?? '', /phase handoff \| side w \| dice ""/);
  assert.equal(headline(root), "White's turn is over");
  assert.equal(prompt(root), "OK: Black's turn");
});

test('against the bot the person’s turn is over and OK starts the bot’s, which ends the same way', () => {
  // The bot's lines go on the voice's own timer.
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    reset();
    const clock = scheduler();
    const { root } = launch(optionsFor([2, 6, 6], clock));
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
  } finally {
    mock.timers.reset();
  }
});

test('a piece in hand is named, not its square, which the board does not label', () => {
  reset();
  const { root, state } = launch(optionsFor([5, 4, 2]));
  // A new hotseat game and queen, rook, knight: only a knight can move. OK
  // picks it up.
  send('enter', 'enter', 'enter');
  assert.match(state() ?? '', /selected g1/);
  assert.equal(prompt(root), 'OK: move the knight here');
  assert.doesNotMatch(text(root), /\b[a-h][1-8]\b/);
  // Back puts it down, and the prompt is the board's again (#240).
  send('back');
  assert.match(state() ?? '', /selected -/);
  assert.equal(prompt(root), 'OK: pick up · Back: menu');
});

test('Black’s piece is named too, on the board turned for Black', () => {
  reset();
  new MMKV().set('dicechess-tv.turnBoard.v1', 'on');
  const { root, state } = launch(optionsFor([1, 1, 1]));
  // A new hotseat game: White plays three pawns, and OK hands the turn over and rolls for Black.
  send('enter', 'enter', 'enter', 'enter', 'enter', 'enter', 'enter', 'enter');
  send('enter');
  // Black picks a pawn up, on the board turned for Black.
  send('enter');
  assert.match(state() ?? '', /side b/);
  assert.match(state() ?? '', /selected [a-h]7/);
  assert.equal(prompt(root), 'OK: move the pawn here');
  assert.doesNotMatch(text(root), /\b[a-h][1-8]\b/);
});

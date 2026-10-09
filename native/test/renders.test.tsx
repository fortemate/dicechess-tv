// How much of the board a key redraws (#312). The game screen renders on every
// key, bot step and timer; the board renders only when its inputs change, and
// then only the squares whose view changed.
import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { hold, press, release } from './stubs/react-native-kepler.mjs';
import { Board } from '../src/Board';
import { Square } from '../src/Square';
import { GameScreen } from '../src/GameScreen';
import type { ScreenOptions } from '../src/screen';
import type { SquareView } from '../../src/core/boardView';

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

// Records every render of a memoized component. React renders the function the
// memo wraps, its `type`, so this swaps that function for one that notes the
// call and draws the same. Swapped before anything mounts, it sees every render
// in this file.
const countRenders = <P,>(memo: unknown, name: (props: P) => string) => {
  const target = memo as { type?: (props: P) => React.ReactNode };
  const draw = target.type;
  assert.equal(typeof draw, 'function', 'renders are counted on a React.memo');
  const seen: string[] = [];
  target.type = (props: P) => {
    seen.push(name(props));
    return draw!(props);
  };
  return {
    // What rendered since the last call, sorted, and a fresh count from here.
    take: () => seen.splice(0).sort(),
  };
};

const squares = countRenders<{ view: SquareView }>(
  Square,
  ({ view }) => view.square,
);
const boards = countRenders<unknown>(Board, () => 'board');

// One tree at a time, as on a device, and none left behind: a screen still
// mounted would take the next test's presses and keep its timers running.
let mounted: renderer.ReactTestRenderer | null = null;
const mount = async (element: React.ReactElement) => {
  await act(async () => {
    mounted = renderer.create(element);
  });
  return mounted!;
};
afterEach(() => {
  if (mounted) act(() => mounted!.unmount());
  mounted = null;
});

const SIZE = 800;
const INITIAL = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR';
// A roll of queen, rook and knight from the start: only the knights can move.
const LEGAL = ['b1a3', 'b1c3', 'g1f3', 'g1h3'];
const MOVABLE = ['b1', 'g1'];

// The board on its own, with the inputs a game screen gives it. The reduced-
// motion answer arrives after the first render and renders the board again,
// so it is awaited before anything is counted.
const mountBoard = async (props: Record<string, unknown>) => {
  const tree = await mount(
    React.createElement(Board, { size: SIZE, ...props } as never),
  );
  squares.take();
  boards.take();
  return (next: Record<string, unknown>) =>
    act(() => {
      tree.update(React.createElement(Board, { size: SIZE, ...next } as never));
    });
};

test('a cursor move redraws the square it leaves and the one it reaches', async () => {
  const shown = { board: INITIAL, legal: LEGAL, movable: MOVABLE };
  const update = await mountBoard({ ...shown, cursor: 'b1' });

  update({ ...shown, cursor: 'g1' });

  assert.deepEqual(boards.take(), ['board']);
  assert.deepEqual(squares.take(), ['b1', 'g1']);
});

test('a board given the same inputs again draws nothing', async () => {
  const shown = {
    board: INITIAL,
    legal: LEGAL,
    movable: MOVABLE,
    cursor: 'b1',
  };
  const update = await mountBoard(shown);

  update({ ...shown });
  assert.deepEqual(boards.take(), [], 'the same values skip the board');

  // New arrays with the same contents render the board, whose squares then
  // compare equal by value and are not drawn again.
  update({ ...shown, legal: [...LEGAL], movable: [...MOVABLE] });
  assert.deepEqual(boards.take(), ['board']);
  assert.deepEqual(squares.take(), []);
});

test('picking a piece up redraws only the squares whose marks change', async () => {
  const shown = { board: INITIAL, legal: LEGAL, movable: MOVABLE };
  const update = await mountBoard({ ...shown, cursor: 'b1' });

  update({ ...shown, cursor: 'a3', selected: 'b1' });

  // b1 is picked up, a3 and c3 become destinations with the cursor on a3, and
  // g1 loses its movable mark while a piece is held.
  assert.deepEqual(squares.take(), ['a3', 'b1', 'c3', 'g1']);
});

// A game screen as the television runs it, in a Hot Seat game with a fixed
// roll. The opponent's steps run at once; nothing here waits on a timer.
const options: ScreenOptions = {
  roll: () => [5, 4, 2],
  newId: () => 'test',
  schedule: (step) => step(),
  side: () => 'w',
};

// The screen sits in a Profiler, which reports each commit the screen took
// part in: a render of the screen that draws no square still counts there.
const mountGame = async () => {
  const reports: string[] = [];
  let commits = 0;
  await mount(
    <React.Profiler id="screen" onRender={() => (commits += 1)}>
      <GameScreen
        options={options}
        onState={(line: string) => reports.push(line)}
      />
    </React.Profiler>,
  );
  // OK on the home screen starts a Hot Seat game, and OK again rolls. The
  // dice ask the platform about motion as they appear; that answer is
  // awaited too.
  act(() => press('enter'));
  act(() => press('enter'));
  await act(async () => {});
  squares.take();
  boards.take();
  commits = 0;
  return {
    state: () => reports[reports.length - 1] ?? '',
    commits: () => commits,
  };
};

test('in a game, a cursor move redraws two squares', async () => {
  const game = await mountGame();
  assert.match(game.state(), /phase move .* cursor g1 /);

  act(() => press('left'));

  assert.match(game.state(), /cursor b1 /);
  assert.deepEqual(boards.take(), ['board']);
  assert.deepEqual(squares.take(), ['b1', 'g1']);
});

test('OK held down on the board draws neither the board nor a square', async () => {
  const game = await mountGame();

  // OK going down only shows the press, on a menu's focused option: the
  // screen renders, and the board's inputs are what they were.
  act(() => hold('enter', 1));
  assert.equal(game.commits(), 1, 'the screen rendered the press');
  assert.deepEqual(boards.take(), []);
  assert.deepEqual(squares.take(), []);

  // Coming up, it picks the knight up, which is a change to draw.
  act(() => release('enter'));
  assert.match(game.state(), /selected g1 /);
  assert.deepEqual(boards.take(), ['board']);
});

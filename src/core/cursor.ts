// Where the cursor waits when a person has a choice to make, and how many
// presses of the remote reach each option (#68).
//
// Positions are taken as the person sees the board: x grows to the right and y
// up the screen. On the board turned for Black that mirrors the square's file
// and rank, so the rules below treat both colours alike.

import { fileOf, rankOf } from './board.ts';

export type Direction = 'up' | 'down' | 'left' | 'right';

const DIRECTIONS: readonly Direction[] = ['up', 'down', 'left', 'right'];

const UNIT: Readonly<Record<Direction, readonly [number, number]>> = {
  up: [0, 1],
  down: [0, -1],
  left: [-1, 0],
  right: [1, 0],
};

// How a press picks among the options ahead of the cursor:
// - axis: the distance ahead plus twice the distance aside, the usual rule of
//   TV focus engines, so an option in line wins over a nearer one off to the side;
// - cone: the nearest option within 45 degrees of the direction, else as axis;
// - nearest: the nearest option anywhere ahead.
export type JumpRule = 'axis' | 'cone' | 'nearest';

export type Layout = {
  rule?: JumpRule;
  flipped?: boolean;
};

const pointOf = (
  square: string,
  flipped: boolean,
): readonly [number, number] =>
  flipped
    ? [7 - fileOf(square), 7 - rankOf(square)]
    : [fileOf(square), rankOf(square)];

// Presses when every press moves the cursor one square, as it does today.
export const steps = (from: string, to: string): number =>
  Math.abs(fileOf(from) - fileOf(to)) + Math.abs(rankOf(from) - rankOf(to));

// Lexicographic order of two keys of the same length.
const before = (a: readonly number[], b: readonly number[]): boolean => {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] < b[i];
  return false;
};

function measure(rule: JumpRule, ahead: number, aside: number): number[] {
  const distance = ahead * ahead + aside * aside;
  if (rule === 'nearest') return [distance];
  if (rule === 'cone')
    return aside <= ahead ? [0, distance] : [1, ahead + 2 * aside];
  return [ahead + 2 * aside];
}

// The option a press lands on, or null when none lies ahead and the cursor
// stays. Ties go to the option nearer the pressed line, then to reading order:
// higher on the screen first, then further left.
export function jump(
  from: string,
  options: readonly string[],
  direction: Direction,
  { rule = 'axis', flipped = false }: Layout = {},
): string | null {
  const [fx, fy] = pointOf(from, flipped);
  const [dx, dy] = UNIT[direction];
  let best: string | null = null;
  let bestKey: number[] = [];
  for (const option of options) {
    const [x, y] = pointOf(option, flipped);
    const ahead = (x - fx) * dx + (y - fy) * dy;
    if (ahead <= 0) continue;
    const aside = Math.abs((x - fx) * dy - (y - fy) * dx);
    const key = [...measure(rule, ahead, aside), aside, -y, x];
    if (best === null || before(key, bestKey)) {
      best = option;
      bestKey = key;
    }
  }
  return best;
}

// Presses from `start` to every option that jumps can reach. `start` need not
// be an option: after a move the cursor may stand where no choice is left.
export function pressesFrom(
  start: string,
  options: readonly string[],
  layout: Layout = {},
): Map<string, number> {
  const presses = new Map<string, number>([[start, 0]]);
  const queue: [string, number][] = [[start, 0]];
  // An array iterator also visits what is pushed during the loop.
  for (const [at, count] of queue) {
    for (const direction of DIRECTIONS) {
      const to = jump(at, options, direction, layout);
      if (to === null || presses.has(to)) continue;
      presses.set(to, count + 1);
      queue.push([to, count + 1]);
    }
  }
  return presses;
}

// More presses than any option reachable on a board can take.
const UNREACHABLE = 64;

// The option to wait on: the one from which the others take the fewest presses
// in total, then the fewest at worst. Ties go to the option nearest `near`, the
// square the cursor stood on, then to reading order. Presses are counted as
// jumps, or as single squares when `stepwise` is set.
export function central(
  options: readonly string[],
  near: string | null = null,
  { stepwise = false, ...layout }: Layout & { stepwise?: boolean } = {},
): string | null {
  let best: string | null = null;
  let bestKey: number[] = [];
  for (const option of options) {
    const presses = stepwise ? null : pressesFrom(option, options, layout);
    let total = 0;
    let worst = 0;
    for (const other of options) {
      const count = presses
        ? (presses.get(other) ?? UNREACHABLE)
        : steps(option, other);
      total += count;
      worst = Math.max(worst, count);
    }
    const [x, y] = pointOf(option, layout.flipped ?? false);
    const key = [total, worst, near ? steps(near, option) : 0, -y, x];
    if (best === null || before(key, bestKey)) {
      best = option;
      bestKey = key;
    }
  }
  return best;
}

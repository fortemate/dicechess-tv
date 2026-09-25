// Presses per turn under each way of moving the cursor that #68 compares.
//
//   node --experimental-strip-types scripts/cursor-presses.ts [games] [seed]
//
// Plays seeded random games through the app's own core, so every run with the
// same arguments sees the same positions and the same moves. Both sides choose
// random legal actions. Random moves are not a person's moves, but every
// strategy is scored on the same ones. The arrows, the OKs and a promotion's
// extra OK are counted; the OK that rolls the dice and the one that passes the
// turn cost the same everywhere and are not.
import {
  moveGame,
  newGame,
  nextTurn,
  rollDice,
  rollGame,
  viewGame,
  type Side,
} from '../src/core/game.ts';
import { actionCost, CURRENT, type Strategy } from '../src/core/presses.ts';

// A whole number of at least `least`, or the usage and exit code 2.
function argument(index: number, fallback: number, least: number): number {
  const raw = process.argv[index];
  const value = raw === undefined ? fallback : Number(raw);
  if (Number.isSafeInteger(value) && value >= least) return value;
  console.error(
    'usage: node --experimental-strip-types scripts/cursor-presses.ts [games >= 1] [seed >= 0]',
  );
  process.exit(2);
}
const GAMES = argument(2, 200, 1);
const SEED = argument(3, 68, 0);

// mulberry32: small, seeded and good enough to pick dice and moves.
function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const random = seeded(SEED);
const fill = (bytes: Uint8Array<ArrayBuffer>) => {
  for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(random() * 256);
};

const jumping: Strategy = {
  pieces: 'jump',
  start: 'stay',
  destinations: 'step',
  rule: 'axis',
};
const STRATEGIES: [string, Strategy][] = [
  ['today: a square per press, cursor stays', CURRENT],
  [
    'a square per press, cursor on the central piece',
    { ...CURRENT, start: 'central' },
  ],
  ['jump, cursor stays', jumping],
  [
    'jump, cursor stays on a movable piece, else central',
    { ...jumping, start: 'sticky' },
  ],
  ['jump, cursor on the central piece', { ...jumping, start: 'central' }],
  [
    'jump + destinations, sticky',
    { ...jumping, start: 'sticky', destinations: 'jump' },
  ],
  [
    'jump + destinations, central',
    { ...jumping, start: 'central', destinations: 'jump' },
  ],
  [
    'cone rule: jump + destinations, sticky',
    { ...jumping, start: 'sticky', destinations: 'jump', rule: 'cone' },
  ],
  [
    'cone rule: jump + destinations, central',
    { ...jumping, start: 'central', destinations: 'jump', rule: 'cone' },
  ],
  [
    'nearest rule: jump + destinations, central',
    { ...jumping, start: 'central', destinations: 'jump', rule: 'nearest' },
  ],
];

// Whose turns are scored. In hotseat both sides share one cursor on a board
// that never turns. The one-colour modes score a single side of the same games
// and leave its cursor where it was during the other side's turns, as when a
// person plays the bot; the board turns for a person playing Black.
type Mode = {
  name: string;
  scores: (side: Side) => boolean;
  flipped: boolean;
  start: string;
};
const MODES: Mode[] = [
  {
    name: 'Hotseat, both sides',
    scores: () => true,
    flipped: false,
    start: 'e2',
  },
  {
    name: 'White only, cursor kept across the other turns',
    scores: (side) => side === 'w',
    flipped: false,
    start: 'e2',
  },
  {
    name: 'Black only, board turned, cursor kept across the other turns',
    scores: (side) => side === 'b',
    flipped: true,
    start: 'e7',
  },
];

type Tally = {
  presses: number;
  actions: number;
  missed: number;
  turns: number[];
};
const tallies = MODES.map(() =>
  STRATEGIES.map((): Tally => ({
    presses: 0,
    actions: 0,
    missed: 0,
    turns: [],
  })),
);

for (let g = 0; g < GAMES; g++) {
  let game = newGame('hotseat', `presses-${g}`);
  const cursors = MODES.map((mode) => STRATEGIES.map(() => mode.start));
  while (game.phase !== 'ended' && game.turn < 400) {
    game = rollGame(game, rollDice(fill));
    const { side } = viewGame(game);
    const turn = MODES.map(() => STRATEGIES.map(() => 0));
    let acted = false;
    while (game.phase === 'move') {
      const { legal } = viewGame(game);
      const move = legal[Math.floor(random() * legal.length)];
      MODES.forEach((mode, m) => {
        if (!mode.scores(side)) return;
        STRATEGIES.forEach(([, strategy], s) => {
          const cost = actionCost(
            strategy,
            cursors[m][s],
            legal,
            move,
            mode.flipped,
          );
          const tally = tallies[m][s];
          tally.presses += cost.presses;
          tally.actions += 1;
          if (!cost.reachable) tally.missed += 1;
          turn[m][s] += cost.presses;
          cursors[m][s] = move.slice(2, 4);
        });
      });
      acted = true;
      game = moveGame(game, move);
    }
    if (acted)
      MODES.forEach((mode, m) => {
        if (mode.scores(side))
          STRATEGIES.forEach((_, s) => tallies[m][s].turns.push(turn[m][s]));
      });
    if (game.phase === 'handoff') game = nextTurn(game);
  }
}

const quantile = (values: number[], q: number) => {
  if (values.length === 0) return Number.NaN;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
};
const fixed = (n: number, digits = 2) => n.toFixed(digits);

console.log(
  `${GAMES} games, seed ${SEED}. Presses per action and per turn with at least one action.\n`,
);
MODES.forEach((mode, m) => {
  const base = tallies[m][0];
  console.log(
    `### ${mode.name}: ${base.turns.length} turns, ${base.actions} actions\n`,
  );
  console.log(
    '| Strategy | Per action | Per turn | Median turn | 90th percentile | Saved per turn | Actions out of reach |',
  );
  console.log('| --- | ---: | ---: | ---: | ---: | ---: | ---: |');
  STRATEGIES.forEach(([name], s) => {
    const t = tallies[m][s];
    const perTurn = t.presses / t.turns.length;
    const saved = base.presses / base.turns.length - perTurn;
    console.log(
      `| ${name} | ${fixed(t.presses / t.actions)} | ${fixed(perTurn)} | ${quantile(t.turns, 0.5)} | ${quantile(t.turns, 0.9)} | ${fixed(saved)} | ${t.missed} |`,
    );
  });
  console.log('');
});

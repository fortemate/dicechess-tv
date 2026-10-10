// Every key hint keeps to one line of the side panel (#240), in the game and in
// the tutorial. A hint on two lines took the room the host's line and the
// bottom badge need, and Amazon's TV guidance asks for as little text as will
// do.
//
// The hints are worked out from real game and lesson states, not copied, so a
// new or reworded hint is held to the same line.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AUTO_PROMPT, promptFor } from '../src/GameScreen';
import { settingsOptions } from '../src/screen';
import { DEFAULT_MUSIC } from '../src/musicSetting';
import { HOST_CHOICES } from '../src/hostSetting';
import { hint } from '../src/TutorialScreen';
import { initialTutorial, type TutorialState } from '../src/tutorial';
import {
  moveGame,
  newGame,
  nextTurn,
  resignGame,
  rollGame,
  viewGame,
  type BotMode,
  type Game,
} from '../../src/core/game';
import { OPPONENTS } from '../../src/core/opponents';
import { TUTORIAL, rollStep, stepGame } from '../../src/core/tutorial';
import { textWidth } from './textWidth';

// The panel beside the board is 372 dp wide on the 960 x 540 dp screen
// (src/layout.ts). The Virtual Device drew lines at most 4.5% wider than
// textWidth's sum, and narrower ones do not wrap, so a hint whose sum is at
// most this fits the line. On the device on 2026-10-06 each hint here took one
// line; the widest, "Done. OK: next lesson · Back: leave", summed 352 dp and
// drew 342, and "OK: move the pawn here" drew 265.
const PANEL_DP = 372;
const FITS_DP = Math.floor(PANEL_DP / 1.05);

// The game's prompt is 24 dp; the tutorial's hint is 22 dp.
const PROMPT_DP = 24;
const TUTORIAL_HINT_DP = 22;

const fits = (text: string, fontSize: number) => {
  const width = textWidth(text, fontSize);
  assert.ok(
    width <= FITS_DP,
    `"${text}" at ${fontSize} dp is about ${Math.round(width)} dp, over ${FITS_DP}`,
  );
};

const prompt = (game: Game, selected: string | null = null) =>
  promptFor(game, viewGame(game), selected);

// A Hot Seat game and a game against each opponent, with the person as White.
const hotseat = () => newGame('hotseat', 'hints');
const against = (mode: BotMode, human: 'w' | 'b' = 'w') =>
  newGame(mode, 'hints', undefined, human, human);

// Knight, king, king at the start: the knight on g1 moves to f3 and the turn
// is over, with both kings' dice left.
const KNIGHT_KING_KING = [2, 6, 6];
const knightPlayed = (game: Game) =>
  moveGame(rollGame(game, KNIGHT_KING_KING), 'g1f3');

test('the game’s hints are each one line', () => {
  const shown = new Set<string>();
  const add = (text: string) => shown.add(text);

  // Before the roll, and choosing a piece.
  add(prompt(hotseat()));
  const rolled = rollGame(hotseat(), [1, 2, 3]);
  add(prompt(rolled));
  // Each kind of piece picked up, from where it stands at the start.
  for (const square of ['e2', 'g1', 'f1', 'h1', 'd1', 'e1'])
    add(prompt(rolled, square));
  // Hot Seat handoffs both ways, and the end of a game on the board.
  const whiteDone = knightPlayed(hotseat());
  add(prompt(whiteDone));
  const blackDone = moveGame(
    rollGame(nextTurn(whiteDone), KNIGHT_KING_KING),
    'g8f6',
  );
  add(prompt(blackDone));
  add(prompt(resignGame(rolled)));
  // OK about to press itself on the only choice (#302).
  add(promptFor(rolled, viewGame(rolled), null, true));

  // Against each opponent: the person's handoff, the opponent at work and
  // waiting to hand back, and its roll with nothing to play.
  for (const { mode } of OPPONENTS) {
    add(prompt(knightPlayed(against(mode))));
    const opponentOpens = against(mode, 'b');
    add(prompt(opponentOpens));
    add(prompt(knightPlayed(opponentOpens)));
    add(prompt(rollGame(opponentOpens, [5, 4, 6])));
  }

  // Every state above has a hint of its own kind; none is missing.
  assert.ok(shown.size >= 15, [...shown].join(' | '));
  for (const text of shown) fits(text, PROMPT_DP);
});

// A setting is an option of 26 dp in a frame: 12 dp of padding and a 2 dp
// border each side (src/Option.tsx).
const OPTION_DP = 26;
const OPTION_INSET_DP = 2 * (12 + 2);

test('every row of Settings is one line, whatever it says', () => {
  const rows = new Set<string>();
  for (const on of [false, true])
    for (const host of HOST_CHOICES)
      for (const row of settingsOptions(
        on,
        DEFAULT_MUSIC,
        true,
        on,
        on,
        host,
        on,
      ))
        rows.add(row);
  assert.ok(rows.has('Auto-select only choice: off'));
  for (const row of rows) {
    const width = textWidth(row, OPTION_DP) + OPTION_INSET_DP;
    assert.ok(
      width <= FITS_DP,
      `"${row}" is about ${Math.round(width)} dp with its frame, over ${FITS_DP}`,
    );
  }
});

test('OK about to press itself says why, and how to stop it', () => {
  const rolled = rollGame(hotseat(), [1, 2, 3]);
  assert.equal(promptFor(rolled, viewGame(rolled), null, true), AUTO_PROMPT);
  assert.equal(AUTO_PROMPT, 'Only one choice · Back: stop');
});

test('a piece in hand is named, and OK moves it there', () => {
  const rolled = rollGame(hotseat(), [1, 2, 3]);
  assert.equal(prompt(rolled, 'f1'), 'OK: move the bishop here');
  assert.equal(prompt(rolled), 'OK: pick up · Back: menu');
});

test('the tutorial’s hints are each one line', () => {
  const at = (index: number, game: Game): TutorialState => ({
    ...initialTutorial(),
    index,
    game,
  });
  const lesson = (id: string) => TUTORIAL.findIndex((step) => step.id === id);
  const shown = new Set<string>();
  const first = initialTutorial();
  shown.add(hint(first));
  shown.add(hint({ ...first, focus: { ...first.focus, selected: 'e2' } }));
  shown.add(hint({ ...first, complete: true }));
  shown.add(hint({ ...at(TUTORIAL.length - 1, first.game), complete: true }));
  // The lesson whose roll leaves nothing to play.
  const pass = lesson('pass');
  shown.add(hint(at(pass, rollStep(TUTORIAL[pass], stepGame(TUTORIAL[pass])))));
  // The capture lesson, missed: the rook moves away from the pawn.
  const capture = lesson('capture');
  const rolled = rollStep(TUTORIAL[capture], stepGame(TUTORIAL[capture]));
  shown.add(hint(at(capture, moveGame(rolled, 'd1a1'))));

  assert.equal(shown.size, 6, [...shown].join(' | '));
  for (const text of shown) fits(text, TUTORIAL_HINT_DP);
});

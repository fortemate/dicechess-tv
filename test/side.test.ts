// The side a person plays against the bot (#53): chosen when the game starts,
// saved with it, and the one the bot's turn, resignation and the board's
// orientation follow.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  decodeGame,
  newGame,
  randomSide,
  resignGame,
  viewGame,
  INITIAL_POSITION,
} from '../src/core/game.ts';
import { botToAct } from '../src/core/bot.ts';
import { boardView } from '../src/core/boardView.ts';

// A save as the app wrote it before a person could choose a colour.
const schema2 = (mode: 'hotseat' | 'random') => {
  const game: Record<string, unknown> = { ...newGame(mode, 'old'), schema: 2 };
  delete game.human;
  delete game.colour;
  return JSON.stringify(game);
};

// A save from when the side was recorded but not the option behind it.
const schema3 = (mode: 'hotseat' | 'random', human: 'w' | 'b' | null) => {
  const game: Record<string, unknown> = {
    ...newGame(mode, 'old', INITIAL_POSITION, human),
    schema: 3,
  };
  delete game.colour;
  return JSON.stringify(game);
};

test('a save from before colours existed resumes with the person as White', () => {
  const bot = decodeGame(schema2('random'));
  assert.equal(bot.schema, 4);
  assert.equal(bot.human, 'w');
  assert.equal(bot.colour, 'w');
  const hotseat = decodeGame(schema2('hotseat'));
  assert.equal(hotseat.human, null);
  assert.equal(hotseat.colour, null);
});

test('a save that recorded only the side keeps that side as its colour option', () => {
  const black = decodeGame(schema3('random', 'b'));
  assert.equal(black.schema, 4);
  assert.equal(black.human, 'b');
  assert.equal(black.colour, 'b');
  assert.equal(decodeGame(schema3('hotseat', null)).colour, null);
});

test('a person playing Black meets the bot on the first move', () => {
  const black = newGame('random', 'black', INITIAL_POSITION, 'b');
  assert.equal(viewGame(black).side, 'w');
  assert.equal(viewGame(black).bot, true);
  assert.equal(botToAct(black), true);

  const white = newGame('random', 'white');
  assert.equal(white.human, 'w');
  assert.equal(botToAct(white), false);

  const hotseat = newGame('hotseat', 'people');
  assert.equal(hotseat.human, null);
  assert.equal(botToAct(hotseat), false);
});

test('resigning against the bot is the person’s loss, whatever their colour', () => {
  const black = resignGame(newGame('random', 'resign', INITIAL_POSITION, 'b'));
  assert.deepEqual(black.result, { winner: 'w', reason: 'resigned' });
  assert.deepEqual(decodeGame(JSON.stringify(black)), black);
});

test('a save must pair its mode with a side', () => {
  const bot = newGame('random', 'pair');
  const hotseat = newGame('hotseat', 'pair');
  // The option is Random or the side itself; hotseat has neither.
  assert.equal(
    decodeGame(JSON.stringify({ ...bot, colour: 'random' })).colour,
    'random',
  );
  for (const damaged of [
    { ...hotseat, human: 'w' },
    { ...bot, human: null },
    { ...bot, human: 'x' },
    { ...hotseat, colour: 'random' },
    { ...bot, colour: null },
    { ...bot, colour: 'b' },
  ])
    assert.throws(
      () => decodeGame(JSON.stringify(damaged)),
      /Unsupported or damaged game save/,
      JSON.stringify(damaged),
    );
});

test('Random gives either colour, decided by one byte', () => {
  assert.equal(
    randomSide((bytes) => bytes.fill(4)),
    'w',
  );
  assert.equal(
    randomSide((bytes) => bytes.fill(7)),
    'b',
  );
});

test('a flipped board is drawn from Black’s side', () => {
  const rows = boardView({
    board: INITIAL_POSITION.split(' ')[0],
    flipped: true,
  });
  assert.deepEqual(
    rows[0].map((view) => view.square),
    ['h1', 'g1', 'f1', 'e1', 'd1', 'c1', 'b1', 'a1'],
  );
  assert.equal(rows[7][0].square, 'h8');
  // The squares keep their colours: a1 stays dark in the top-right corner.
  assert.equal(rows[0][7].dark, true);
  assert.equal(rows[0][7].piece, 'R');
});

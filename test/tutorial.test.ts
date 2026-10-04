import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  TUTORIAL,
  stepGame,
  rollStep,
  taskAt,
  speechAt,
  passStep,
  isMissed,
  MISSED_SPEECH,
  CLOSING_SPEECH,
  ROLL_TASK,
  isComplete,
  type TutorialStep,
} from '../src/core/tutorial.ts';
import { emptyRoll, moveGame, viewGame, decodeGame } from '../src/core/game.ts';
import { pieceAt } from '../src/core/board.ts';

// The step with its dice rolled, by the OK that opens it.
const rolled = (step: TutorialStep) => rollStep(step, stepGame(step));

// Every line Thinkle may say in a step.
const linesOf = (step: TutorialStep) =>
  Object.values(step.speech).flatMap((lines) => [...(lines ?? [])]);

// Play a step through, always taking the first legal action, until it is
// complete or there is nothing left to play. A roll no die can use is passed,
// as OK passes it.
const playOut = (
  step: TutorialStep,
  choose = (legal: string[]) => legal[0],
) => {
  let game = rolled(step);
  for (let i = 0; i < 4 && !isComplete(step, game); i++) {
    const legal = viewGame(game).legal;
    if (!legal.length) return passStep(game);
    game = moveGame(game, choose(legal));
  }
  return game;
};

test('every step starts from a position the engine accepts', () => {
  for (const step of TUTORIAL) {
    const game = stepGame(step);
    // stepGame goes through decodeGame, but assert it explicitly: a lesson
    // built on a position the controller would refuse is worse than no lesson.
    assert.deepEqual(decodeGame(JSON.stringify(game)), game);
    assert.equal(game.start.split(' ').length, 6, step.id);
    assert.deepEqual(rolled(step).roll, step.roll, step.id);
  }
});

test('every step offers the player something to do', () => {
  for (const step of TUTORIAL) {
    const game = rolled(step);
    const state = viewGame(game);
    assert.equal(state.remaining.length, 3, step.id);
    // The lesson about a roll no die can use offers OK, which passes; every
    // other lesson offers an action.
    if (step.goal.kind === 'pass') assert.ok(emptyRoll(game), step.id);
    else assert.ok(state.legal.length > 0, `${step.id} has no legal action`);
  }
});

test('every step can be completed, and is not complete before it is played', () => {
  for (const step of TUTORIAL) {
    assert.equal(
      isComplete(step, stepGame(step)),
      false,
      `${step.id} starts complete`,
    );
    assert.equal(
      isComplete(step, rolled(step)),
      false,
      `${step.id} is complete once rolled`,
    );
    const goal = step.goal;
    const finished = playOut(step, (legal) => {
      // Steps with a named target need that action chosen, not just any.
      if (goal.kind === 'capture')
        return legal.find((m) => m.slice(2, 4) === goal.square) ?? legal[0];
      if (goal.kind === 'kingCapture')
        return legal.find((m) => m.slice(2, 4) === 'a8') ?? legal[0];
      return legal[0];
    });
    assert.ok(isComplete(step, finished), `${step.id} could not be completed`);
  }
});

test('the dice lesson really does permit only knights', () => {
  const dice = TUTORIAL.find((step) => step.id === 'dice')!;
  const game = rolled(dice);
  const state = viewGame(game);
  assert.equal(state.remaining, 'QBN');
  // Only the knight die stays lit, so the dice agree with "Nothing else can
  // move on this roll" for the whole turn, not only its first action.
  assert.equal(state.playable, 'N');
  // Every legal action starts on a knight, which is what makes the lesson true.
  const board = state.dfen.split(' ')[0];
  for (const move of state.legal) {
    assert.equal(pieceAt(board, move.slice(0, 2)), 'N', move);
  }
});

test('the capture lesson has a pawn to take and the rook to take it with', () => {
  const capture = TUTORIAL.find((step) => step.id === 'capture')!;
  const game = rolled(capture);
  const board = viewGame(game).dfen.split(' ')[0];
  assert.equal(pieceAt(board, 'd5'), 'p');
  assert.equal(pieceAt(board, 'd1'), 'R');
  assert.ok(viewGame(game).legal.includes('d1d5'));
  assert.ok(isComplete(capture, moveGame(game, 'd1d5')));
});

test('the king lesson ends the game by capture, not by anything else', () => {
  const king = TUTORIAL.find((step) => step.id === 'king')!;
  const game = rolled(king);
  assert.ok(viewGame(game).legal.includes('a1a8'));
  const taken = moveGame(game, 'a1a8');
  assert.deepEqual(taken.result, { winner: 'w', reason: 'king-captured' });
  assert.ok(isComplete(king, taken));

  // A different rook move does not finish the lesson.
  const elsewhere = moveGame(game, 'a1a4');
  assert.equal(isComplete(king, elsewhere), false);
});

test('the tutorial teaches what the roadmap asks and defers the rest', () => {
  assert.deepEqual(
    TUTORIAL.map((step) => step.id),
    ['move', 'dice', 'clear', 'pass', 'capture', 'king'],
  );
  // Castling and promotion are reference material, not a first lesson.
  const words = TUTORIAL.map((s) => [s.task, ...linesOf(s)].join(' '))
    .join(' ')
    .toLowerCase();
  assert.doesNotMatch(words, /castl|promot/);
});

test('a tutorial game is its own, and cannot be mistaken for a real one', () => {
  for (const step of TUTORIAL) {
    assert.match(stepGame(step).id, /^tutorial-/);
  }
  // Ids are distinct, so one step cannot be taken for another.
  const ids = TUTORIAL.map((step) => stepGame(step).id);
  assert.equal(new Set(ids).size, TUTORIAL.length);
});

test('every lesson opens on its roll, as every turn of a game does', () => {
  for (const step of TUTORIAL) {
    const opened = stepGame(step);
    assert.equal(opened.phase, 'roll', step.id);
    assert.deepEqual(viewGame(opened).legal, [], step.id);
    assert.equal(taskAt(step, opened), ROLL_TASK);
    assert.equal(taskAt(step, rolled(step)), step.task);
  }
  // OK rolls the lesson's own dice, every time: three pawns in the first.
  assert.equal(viewGame(rolled(TUTORIAL[0])).remaining, 'PPP');
});

test('the first lesson is a whole turn, and every way to play it ends it', () => {
  const first = TUTORIAL[0];
  // Walk every order of the three pawn moves: each ends the turn, so no
  // player can be left with dice and nothing to do.
  const walk = (game: ReturnType<typeof stepGame>, depth: number): void => {
    const legal = viewGame(game).legal;
    if (!legal.length) {
      assert.ok(isComplete(first, game));
      assert.equal(game.moves.length, 3);
      return;
    }
    assert.equal(isComplete(first, game), false);
    if (depth < 2)
      for (const move of legal) walk(moveGame(game, move), depth + 1);
    else walk(moveGame(game, legal[0]), depth + 1);
  };
  walk(rolled(first), 0);
});

test('Thinkle says what fits the moment of the first lesson', () => {
  const first = TUTORIAL[0];
  const opened = stepGame(first);
  assert.deepEqual(speechAt(first, opened, false), first.speech.opening);
  const game = rollStep(first, opened);
  assert.deepEqual(speechAt(first, game, false), first.speech.rolled);
  const once = moveGame(game, viewGame(game).legal[0]);
  assert.deepEqual(speechAt(first, once, false), first.speech.moved);
  const twice = moveGame(once, viewGame(once).legal[0]);
  assert.deepEqual(speechAt(first, twice, false), first.speech.moved);
  const done = moveGame(twice, viewGame(twice).legal[0]);
  assert.ok(isComplete(first, done));
  assert.deepEqual(speechAt(first, done, true), first.speech.done);
});

test('Thinkle says what fits the moment of the dice lesson', () => {
  const dice = TUTORIAL.find((step) => step.id === 'dice')!;
  assert.deepEqual(speechAt(dice, stepGame(dice), false), dice.speech.opening);
  const game = rolled(dice);
  assert.deepEqual(speechAt(dice, game, false), dice.speech.rolled);
  // Any knight move ends the turn with the queen and bishop dice unused, as
  // his last line says.
  for (const move of viewGame(game).legal) {
    const played = moveGame(game, move);
    assert.ok(isComplete(dice, played), move);
    assert.equal(viewGame(played).remaining, 'QB', move);
    assert.deepEqual(speechAt(dice, played, true), dice.speech.done);
  }
});

test('a moment without lines of its own keeps the lines before it', () => {
  const step = { ...TUTORIAL[0], speech: { opening: ['Only this.'] } };
  const game = rolled(step);
  assert.deepEqual(speechAt(step, game, false), ['Only this.']);
  const played = moveGame(game, viewGame(game).legal[0]);
  assert.deepEqual(speechAt(step, played, false), ['Only this.']);
});

test('every line Thinkle says can be recorded as one clip', () => {
  // The voice packs' rules: plain ASCII, a pause written "...", and at most 56
  // characters (fortemate/dicechess-assets, docs/CHARACTERS.md).
  for (const step of TUTORIAL)
    for (const line of [
      ...linesOf(step),
      ...MISSED_SPEECH,
      ...CLOSING_SPEECH,
    ]) {
      assert.match(line, /^[\x20-\x7e]+$/, `${step.id}: ${line}`);
      assert.ok(line.length <= 56, `${step.id}: ${line} (${line.length})`);
    }
});

test('the clear-the-way lesson offers only pawns that free the others', () => {
  const clear = TUTORIAL.find((step) => step.id === 'clear')!;
  const game = rolled(clear);
  const view = viewGame(game);
  // The bishop and queen cannot move yet, but their dice are lit, as Thinkle
  // says: a pawn can free them.
  assert.equal(view.remaining, 'PBQ');
  assert.equal(view.playable, 'PBQ');
  const board = view.dfen.split(' ')[0];
  for (const move of view.legal)
    assert.equal(pieceAt(board, move.slice(0, 2)), 'P', move);
  // Only the pawns that open a way glow: any other would waste a die.
  assert.deepEqual(
    [...new Set(view.legal.map((move) => move.slice(0, 2)))].sort(),
    ['b2', 'd2', 'e2'],
  );
});

test('every way to play the clear-the-way lesson spends all three dice', () => {
  const clear = TUTORIAL.find((step) => step.id === 'clear')!;
  let turns = 0;
  const walk = (game: ReturnType<typeof stepGame>): void => {
    const legal = viewGame(game).legal;
    if (!legal.length) {
      turns++;
      assert.ok(isComplete(clear, game));
      assert.equal(game.moves.length, 3, game.moves.join(' '));
      assert.deepEqual(speechAt(clear, game, true), clear.speech.done);
      return;
    }
    assert.equal(isComplete(clear, game), false);
    if (game.moves.length > 0)
      assert.deepEqual(speechAt(clear, game, false), clear.speech.moved);
    for (const move of legal) walk(moveGame(game, move));
  };
  walk(rolled(clear));
  assert.ok(turns > 0);
});

test('the lesson about a roll no die can use: every die grey, and OK passes', () => {
  const pass = TUTORIAL.find((step) => step.id === 'pass')!;
  const game = rolled(pass);
  // Queen, rook and king, all boxed in at the start: nothing glows and every
  // die is grey, as Thinkle says.
  assert.ok(emptyRoll(game));
  assert.equal(viewGame(game).remaining, 'QRK');
  assert.equal(viewGame(game).playable, '');
  assert.equal(isComplete(pass, game), false);
  assert.deepEqual(speechAt(pass, game, false), pass.speech.rolled);
  assert.equal(taskAt(pass, game), pass.task);

  const passed = passStep(game);
  assert.ok(isComplete(pass, passed));
  assert.equal(passed.turn, 2);
  assert.deepEqual(speechAt(pass, passed, true), pass.speech.done);
});

test('"it happens often": no die can be used on about 30% of opening rolls', () => {
  // Thinkle's last line in the lesson rests on this. Count every roll of three
  // dice from the starting position.
  let empty = 0;
  for (let a = 1; a <= 6; a++)
    for (let b = 1; b <= 6; b++)
      for (let c = 1; c <= 6; c++)
        if (
          emptyRoll(
            rollStep(
              { ...TUTORIAL[0], roll: [a, b, c] },
              stepGame(TUTORIAL[0]),
            ),
          )
        )
          empty++;
  assert.equal(empty, 64);
  assert.ok(empty / 216 > 0.29);
});

test('passing changes nothing when a roll has a move', () => {
  const game = rolled(TUTORIAL[0]);
  assert.equal(passStep(game), game);
});

test('no lesson can strand the player: every way to play it ends done or missed', () => {
  // Walk every way to play every lesson from its roll. Each ends with the
  // lesson done, or missed with OK offering it again; none leaves a board that
  // takes no keys.
  for (const step of TUTORIAL) {
    const walk = (game: ReturnType<typeof stepGame>): void => {
      const legal = viewGame(game).legal;
      if (legal.length) {
        assert.equal(isMissed(step, game), false, step.id);
        for (const move of legal) walk(moveGame(game, move));
        return;
      }
      const end = passStep(game);
      assert.ok(
        isComplete(step, end) || isMissed(step, end),
        `${step.id}: ${game.moves.join(' ')}`,
      );
      assert.notEqual(isComplete(step, end), isMissed(step, end), step.id);
    };
    walk(rolled(step));
  }
});

test('the capture lesson: one rook move, and only the pawn completes it', () => {
  const capture = TUTORIAL.find((step) => step.id === 'capture')!;
  const game = rolled(capture);
  // No queen or bishop on the board, so their dice are grey at the roll.
  assert.equal(viewGame(game).remaining, 'RQB');
  assert.equal(viewGame(game).playable, 'R');
  assert.deepEqual(speechAt(capture, game, false), capture.speech.rolled);
  for (const move of viewGame(game).legal) {
    const played = moveGame(game, move);
    // One move ends the turn, whichever it is.
    assert.equal(viewGame(played).legal.length, 0, move);
    if (move === 'd1d5') {
      assert.ok(isComplete(capture, played));
      assert.deepEqual(speechAt(capture, played, true), capture.speech.done);
    } else {
      assert.ok(isMissed(capture, played), move);
      assert.equal(played.result, null, move);
      assert.deepEqual(speechAt(capture, played, false), MISSED_SPEECH);
    }
  }
});

test('the king lesson: one rook move, and only taking the king wins it', () => {
  const king = TUTORIAL.find((step) => step.id === 'king')!;
  const game = rolled(king);
  assert.equal(viewGame(game).playable, 'R');
  assert.deepEqual(speechAt(king, game, false), king.speech.rolled);
  for (const move of viewGame(game).legal) {
    const played = moveGame(game, move);
    if (move === 'a1a8') {
      assert.deepEqual(played.result, { winner: 'w', reason: 'king-captured' });
      assert.deepEqual(speechAt(king, played, true), king.speech.done);
    } else {
      assert.ok(isMissed(king, played), move);
    }
  }
});

test('Thinkle never says check or checkmate, and never names a die by number', () => {
  // The voice packs' rules: Dice Chess has no check, and a die shows a piece.
  for (const step of TUTORIAL)
    for (const line of [
      ...linesOf(step),
      ...MISSED_SPEECH,
      ...CLOSING_SPEECH,
    ]) {
      assert.doesNotMatch(line, /\bcheck(mate)?\b|stalemate/i, line);
      assert.doesNotMatch(
        line,
        /\b(one|two|three|four|five|six)\b.*\bon (a|the) die\b/i,
        line,
      );
      assert.doesNotMatch(line, /\d/, line);
    }
});

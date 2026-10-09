import { test } from 'node:test';
import assert from 'node:assert/strict';
import { act } from 'react-test-renderer';
import {
  listenerCount,
  hasExited,
  clearExit,
} from './stubs/react-native-kepler.mjs';
import { reset } from './stubs/react-native-mmkv.mjs';
import { MmkvSnapshotStore } from '../src/mmkvStore';
import {
  decodeGame,
  viewGame,
  newGame,
  rollGame,
  type Game,
} from '../../src/core/game';
import { decodeLedger, type Ledger } from '../../src/core/ledger';
import { TUTORIAL, isComplete, stepGame } from '../../src/core/tutorial';
import { portraitPath } from '../src/Portrait';
import { TEACHER_PORTRAIT } from '../src/Teacher';
import {
  CLOSING_CHOICES,
  initialTutorial,
  tutorialReducer,
  step,
} from '../src/tutorial';
import { Dice } from '../src/Dice';
import {
  movableSquares,
  movesFrom,
  type BoardKey,
} from '../../src/core/boardInput';
import { route, RULE } from '../../src/core/cursor';
import type { Square } from '../../src/core/board';
import { RULES } from '../../src/core/rules';
import { focusedLabel, optionViews } from './options';
import { fakeTimers, launch, send, text } from './support';

// Thinkle says his lines one after the other, on the test's clock.
fakeTimers();

// The tutorial is open: Thinkle's name is on screen.
const TUTORIAL_OPEN = /THINKLE/;

// Play the current step by taking the action it teaches, through the reducer.
// A step that opens before its roll is rolled first, with OK.
const solve = (state: ReturnType<typeof initialTutorial>) => {
  const current = step(state);
  const goal = current.goal;
  let played =
    state.game.phase === 'roll' ? tutorialReducer(state, 'select') : state;
  for (let i = 0; i < 4 && !played.complete; i++) {
    const legal = viewGame(played.game).legal;
    // A roll no die can use: OK passes it.
    if (!legal.length) {
      played = tutorialReducer(played, 'select');
      break;
    }
    const move =
      goal.kind === 'capture'
        ? (legal.find((m) => m.slice(2, 4) === goal.square) ?? legal[0])
        : goal.kind === 'kingCapture'
          ? (legal.find((m) => m.slice(2, 4) === 'a8') ?? legal[0])
          : legal[0];
    // Jump to the piece and pick it up, then jump to the target and play it.
    const [from, to] = [move.slice(0, 2), move.slice(2, 4)];
    const holding = [
      ...jumps(played.focus.cursor, from, movableSquares(legal)),
      'select' as const,
    ].reduce((s, key) => tutorialReducer(s, key), played);
    const targets = movesFrom(legal, from).map((action) => action.slice(2, 4));
    played = [
      ...jumps(holding.focus.cursor, to, targets),
      'select' as const,
    ].reduce((s, key) => tutorialReducer(s, key), holding);
  }
  return played;
};

// The jumps from `from` to `to` among `options`, as the reducer makes them.
const jumps = (from: string, to: string, options: string[]): BoardKey[] => {
  const keys = route(from, to, options, { rule: RULE });
  assert.ok(keys, `${to} is out of reach`);
  return keys;
};

test('every lesson can be completed through the same input the game uses', () => {
  let state = initialTutorial();
  for (let i = 0; i < TUTORIAL.length; i++) {
    assert.equal(state.index, i);
    state = solve(state);
    assert.ok(state.complete, `lesson ${step(state).id} could not be finished`);
    state = tutorialReducer(state, 'select');
  }
  assert.ok(state.finished);
});

test('it is skippable at any point, and Back cancels a selection first', () => {
  // From the first lesson.
  assert.ok(tutorialReducer(initialTutorial(), 'back').exit);

  // Before the roll, OK rolls and nothing is picked up.
  const rolled = tutorialReducer(initialTutorial(), 'select');
  assert.equal(rolled.focus.selected, null);
  assert.equal(rolled.game.phase, 'move');

  // With a piece in hand, Back puts it down rather than leaving. The cursor
  // waits on a pawn, and the first lesson rolls three pawns.
  const holding = tutorialReducer(rolled, 'select');
  assert.notEqual(holding.focus.selected, null);
  const cancelled = tutorialReducer(holding, 'back');
  assert.equal(cancelled.focus.selected, null);
  assert.equal(cancelled.exit, false);
  assert.ok(tutorialReducer(cancelled, 'back').exit);

  // And between lessons.
  const done = solve(initialTutorial());
  assert.ok(tutorialReducer(done, 'back').exit);
});

test('the board takes no input once a lesson is done', () => {
  const done = solve(initialTutorial());
  assert.equal(tutorialReducer(done, 'up'), done);
  assert.equal(tutorialReducer(done, 'right'), done);
});

test('a lesson is played on its own game, not on a real one', () => {
  for (const s of TUTORIAL) {
    assert.match(stepGame(s).id, /^tutorial-/);
  }
  const state = solve(initialTutorial());
  assert.ok(isComplete(step(state), state.game));
  assert.match(state.game.id, /^tutorial-/);
});

test('playing the tutorial changes neither the saved game nor the record', () => {
  reset();
  const { root } = launch();
  // Play a real game to a result first, so there is something to protect.
  send('enter', 'enter');
  send('back', 'down', 'select', 'down', 'select');
  send('enter');
  const games = new MmkvSnapshotStore<Game>({
    key: 'dicechess-tv.game.v2',
    decode: decodeGame,
  });
  const ledgers = new MmkvSnapshotStore<Ledger>({
    key: 'dicechess-tv.ledger.v1',
    decode: decodeLedger,
  });
  const savedBefore = JSON.stringify(games.read());
  const ledgerBefore = JSON.stringify(ledgers.read());
  assert.notEqual(ledgerBefore, 'null');

  // Open the tutorial. The finished game is not resumable, so the home screen
  // offers three choices and Learn to play is the last.
  send('down', 'down', 'enter');
  assert.match(text(root), TUTORIAL_OPEN);
  send('right', 'down', 'enter', 'up', 'enter');

  assert.equal(JSON.stringify(games.read()), savedBefore);
  assert.equal(JSON.stringify(ledgers.read()), ledgerBefore);
});

test('the tutorial takes the remote, so a press is not handled twice', () => {
  reset();
  const { root } = launch();
  // Trees from earlier tests stay mounted, so count the change rather than the
  // total.
  const before = listenerCount();

  send('down', 'down', 'enter');
  assert.match(text(root), TUTORIAL_OPEN);
  // Both screens are mounted and both are listening, because a hook cannot be
  // conditional. The game screen must ignore keys, or every press would move
  // the cursor twice and start games behind the lesson.
  assert.equal(listenerCount(), before + 1);

  send('right');
  assert.match(text(root), TUTORIAL_OPEN);
  send('back');
  assert.match(text(root), /Dice Chess/);
  assert.equal(listenerCount(), before);
});

test('leaving the tutorial returns to the home screen', () => {
  reset();
  const { root } = launch();
  send('down', 'down', 'enter');
  assert.match(text(root), TUTORIAL_OPEN);
  send('back');
  assert.doesNotMatch(text(root), TUTORIAL_OPEN);
  assert.match(text(root), /Dice Chess/);
});

test('the panel says which of the two things Back will do', () => {
  reset();
  const { root } = launch();
  send('down', 'down', 'enter');
  assert.match(text(root), /Back: leave the tutorial/);

  // With a piece in hand Back puts it down, and the panel says so rather than
  // promising to leave.
  send('enter', 'enter');
  assert.match(text(root), /Back: put the piece down/);
  assert.doesNotMatch(text(root), /Back: leave the tutorial/);

  send('back');
  assert.match(text(root), /Back: leave the tutorial/);
  assert.match(text(root), TUTORIAL_OPEN);

  send('back');
  assert.match(text(root), /Dice Chess/);
});

test('Back leaves from a finished lesson too', () => {
  reset();
  const { root } = launch();
  send('down', 'down', 'enter');
  // Play the first lesson: roll, then three pawn moves. The cursor waits on a
  // pawn, lands on a square it may go to, and stays on it after the move.
  send('enter', 'enter', 'enter', 'enter', 'enter', 'enter', 'enter');
  assert.match(text(root), /Done\. OK: next lesson · Back: leave/);
  send('back');
  assert.match(text(root), /Dice Chess/);
});

test('the rules guide opens, moves between topics and returns', () => {
  reset();
  const { root } = launch();
  // Home: new hotseat, Play the computer, Learn to play, Rules reference.
  send('down', 'down', 'down', 'enter');
  assert.match(text(root), /RULES/);
  assert.match(text(root), /How a game ends/);
  assert.match(text(root), /There is no checkmate/);
  // The topics are framed options, not text behind a caret, so a title that
  // wraps keeps its second line under its first.
  assert.deepEqual(
    optionViews(root).map(({ label }) => label),
    RULES.map(({ title }) => title),
  );
  assert.equal(focusedLabel(root), RULES[0].title);

  // OK keeps the selected topic open, as the guide already shows its text.
  send('enter');
  assert.equal(focusedLabel(root), RULES[0].title);
  assert.match(text(root), /RULES REFERENCE/);
  assert.match(text(root), /Up\/Down: another topic/);

  // Moving down changes the text without opening anything.
  send('down');
  assert.match(text(root), /Your turn/);
  assert.match(
    text(root),
    /A normal move spends one die; castling spends a king die and a rook die/,
  );

  // Up from the first topic wraps, so a remote never reaches a dead end.
  send('up', 'up');
  assert.match(text(root), /Draws/);

  send('back');
  assert.match(text(root), /Dice Chess/);
});

test('the guide never touches a game or the record', () => {
  reset();
  const { root } = launch();
  send('enter', 'enter');
  send('back', 'down', 'select', 'down', 'select');
  send('enter');
  const games = new MmkvSnapshotStore<Game>({
    key: 'dicechess-tv.game.v2',
    decode: decodeGame,
  });
  const ledgers = new MmkvSnapshotStore<Ledger>({
    key: 'dicechess-tv.ledger.v1',
    decode: decodeLedger,
  });
  const savedBefore = JSON.stringify(games.read());
  const ledgerBefore = JSON.stringify(ledgers.read());

  send('down', 'down', 'down', 'enter');
  assert.match(text(root), /RULES/);
  send('down', 'down', 'back');

  assert.equal(JSON.stringify(games.read()), savedBefore);
  assert.equal(JSON.stringify(ledgers.read()), ledgerBefore);
});

test('the About screen shows the credits and returns on Back or OK', () => {
  reset();
  clearExit();
  const { root } = launch();
  // About is the last item and the menu wraps, so Up from the top reaches it
  // however many items are added above.
  send('up', 'enter');
  assert.match(text(root), /ABOUT/);
  // The credit a licence requires is only met if it is on the screen. No
  // portrait failed to load here, so the screen credits the portraits and the
  // pieces alone to RhosGFX; test/about.test.tsx covers a build without them.
  assert.match(text(root), /Pieces by RhosGFX/);
  assert.match(text(root), /Portraits made with Recraft/);
  assert.match(text(root), /Dice Chess engine by Fortemate/);
  assert.match(text(root), /CC0 1\.0/);

  // Back returns to the menu, and is claimed — it must not close the app.
  send('back');
  assert.equal(hasExited(), false, 'Back on About closed the app');
  assert.doesNotMatch(text(root), /ABOUT/);
  assert.match(text(root), /New Hot Seat game/);

  // OK leaves too: there is nothing on this page to select. The cursor came back
  // to the top of the menu, so Up reaches About again.
  send('up', 'enter');
  assert.match(text(root), /ABOUT/);
  send('enter');
  assert.doesNotMatch(text(root), /ABOUT/);
  assert.match(text(root), /New Hot Seat game/);
});

test('Thinkle teaches: his portrait, his name and the lesson number', () => {
  reset();
  const { root } = launch();
  send('down', 'down', 'enter');
  const teacher = root.find(
    (node) => typeof node.type === 'string' && node.props.testID === 'teacher',
  );
  const portrait = teacher.find(
    (node) => (node.type as unknown as string) === 'Image',
  );
  assert.equal(portrait.props.source.uri, portraitPath('thinkle', 'card'));
  assert.match(text(root), /THINKLE\nLesson 1 of 6/);

  // A build without the portraits keeps his place, so nothing moves.
  act(() => portrait.props.onError());
  const empty = teacher.find(
    (node) =>
      typeof node.type === 'string' &&
      node.props.testID === 'portrait-missing-thinkle',
  );
  assert.equal(empty.props.style.width, TEACHER_PORTRAIT);
  assert.equal(empty.props.style.height, TEACHER_PORTRAIT);
  assert.match(text(root), /THINKLE/);
  send('back');
});

test('the first lesson opens on the roll, and Thinkle follows it through', () => {
  reset();
  const { root } = launch();
  send('down', 'down', 'enter');
  const { speech } = TUTORIAL[0];
  // Before the roll: his welcome, and the task asks for the roll.
  assert.match(text(root), /Welcome, my friend! I am Thinkle/);
  assert.match(text(root), /Press OK to roll the dice\./);

  // OK rolls three pawns.
  send('enter');
  assert.match(text(root), new RegExp(speech.rolled![0]));
  assert.match(text(root), /press OK on a dot/);

  // A pawn moves: one die spent, two to go.
  send('enter', 'enter');
  assert.match(text(root), new RegExp(speech.moved![0]));

  // The other two: the turn is over and the lesson is done.
  send('enter', 'enter', 'enter', 'enter');
  assert.match(text(root), new RegExp(speech.done![0]));
  assert.match(text(root), /Done\. OK: next lesson/);
  // Nothing is left to do on the board, so the task is gone.
  assert.doesNotMatch(text(root), /press OK on a dot/);
  send('back');
});

test('the second lesson opens on its roll too, and Thinkle explains the grey dice', () => {
  reset();
  const { root } = launch();
  send('down', 'down', 'enter');
  // The first lesson: the roll and three pawn moves, then on to the next.
  send('enter', 'enter', 'enter', 'enter', 'enter', 'enter', 'enter');
  send('enter');
  assert.match(text(root), /Lesson 2 of 6/);
  assert.match(text(root), /Now, a little secret of the dice\./);
  assert.match(text(root), /Press OK to roll the dice\./);

  send('enter');
  assert.match(text(root), /Their dice go grey\./);
  assert.match(text(root), /Play a knight\./);

  // The cursor waits on a knight and lands where it may go: one move ends the
  // turn.
  send('enter', 'enter');
  assert.match(text(root), /Well leapt!/);
  assert.match(text(root), /Done\. OK: next lesson/);
  send('back');
});

test('the third lesson: a pawn clears the way for the bishop and the queen', () => {
  reset();
  const { root } = launch();
  send('down', 'down', 'enter');
  // Lessons 1 and 2, each from its roll.
  send('enter', 'enter', 'enter', 'enter', 'enter', 'enter', 'enter');
  send('enter');
  send('enter', 'enter', 'enter');
  send('enter');
  assert.match(text(root), /Lesson 3 of 6/);
  assert.match(text(root), /Clear the way/);
  assert.match(text(root), /stuck behind its own pawns/);

  send('enter');
  assert.match(text(root), /yet their dice are lit/);
  assert.match(text(root), /Move a glowing pawn/);

  // The cursor waits on a glowing pawn; it moves, and the way is open.
  send('enter', 'enter');
  assert.match(text(root), /The way is open!/);

  // The bishop and the queen, wherever the cursor lands them.
  send('enter', 'enter', 'enter', 'enter');
  assert.match(text(root), /Use every die you can: that is the rule\./);
  assert.match(text(root), /Done\. OK: next lesson/);
  send('back');
});

test('the fourth lesson: no die can be used, and OK passes the turn', () => {
  // Through the reducer: lessons 1 to 3, then this one's roll.
  let state = initialTutorial();
  for (let i = 0; i < 3; i++) state = tutorialReducer(solve(state), 'select');
  assert.equal(step(state).id, 'pass');
  state = tutorialReducer(state, 'select');
  assert.equal(viewGame(state.game).legal.length, 0);
  assert.equal(state.complete, false);

  // The arrows change nothing; OK passes, and the lesson is done.
  assert.equal(tutorialReducer(state, 'up'), state);
  const passed = tutorialReducer(state, 'select');
  assert.ok(passed.complete);
  assert.equal(passed.game.turn, 2);
  // Back leaves, as everywhere.
  assert.ok(tutorialReducer(state, 'back').exit);
});

test('on a roll no die can use, the hint says what OK does', () => {
  reset();
  const { root } = launch();
  send('down', 'down', 'enter');
  // Lessons 1 to 3, each from its roll.
  send('enter', 'enter', 'enter', 'enter', 'enter', 'enter', 'enter', 'enter');
  send('enter', 'enter', 'enter', 'enter');
  send('enter', 'enter', 'enter', 'enter', 'enter', 'enter', 'enter', 'enter');
  assert.match(text(root), /Lesson 4 of 6/);
  assert.match(text(root), /the dice play a little trick/);

  send('enter');
  assert.match(text(root), /your turn simply passes/);
  assert.match(
    text(root),
    /No die can be used, so the turn passes\. Press OK\./,
  );
  assert.match(text(root), /OK: pass the turn · Back: leave/);

  send('enter');
  assert.match(text(root), /No harm done!/);
  assert.match(text(root), /Done\. OK: next lesson/);
  send('back');
});

test('a missed lesson offers OK to try again, from its roll', () => {
  let state = initialTutorial();
  for (let i = 0; i < 4; i++) state = tutorialReducer(solve(state), 'select');
  assert.equal(step(state).id, 'capture');
  state = tutorialReducer(state, 'select');
  // The rook goes up the file one square instead of taking the pawn: the turn
  // is over and the lesson missed.
  const missed = [
    ...jumps(
      state.focus.cursor,
      'd1',
      movableSquares(viewGame(state.game).legal),
    ),
    'select' as const,
  ].reduce((s, key) => tutorialReducer(s, key), state);
  const played = [
    ...jumps(missed.focus.cursor, 'd2', [
      'd2',
      'd3',
      'd4',
      'd5',
      'a1',
      'b1',
      'c1',
    ]),
    'select' as const,
  ].reduce((s, key) => tutorialReducer(s, key), missed);
  assert.equal(played.game.lastMove, 'd1d2');
  assert.equal(played.complete, false);

  // The arrows change nothing; OK starts the lesson again, before its roll.
  assert.equal(tutorialReducer(played, 'left'), played);
  const again = tutorialReducer(played, 'select');
  assert.equal(again.index, played.index);
  assert.equal(again.game.phase, 'roll');
  assert.deepEqual(again.game.moves, []);
  assert.ok(tutorialReducer(played, 'back').exit);
});

test('after the last lesson: finish, then the closing words on the starting position', () => {
  let state = initialTutorial();
  for (let i = 0; i < TUTORIAL.length - 1; i++)
    state = tutorialReducer(solve(state), 'select');
  const last = solve(state);
  assert.ok(last.complete);
  const closing = tutorialReducer(last, 'select');
  assert.ok(closing.finished);
  // The board is set up for a game again, and is not the lesson's.
  assert.equal(closing.game.start, stepGame(TUTORIAL[0]).start);
  assert.match(closing.game.id, /^tutorial-/);
  assert.deepEqual(closing.game.roll, []);
});

// Every lesson played on the remote, from the first one's opening until the
// last one is done. Each OK rolls, picks up the piece the cursor waits on,
// plays the move it lands on, passes the turn, or goes on to the next lesson.
const playEveryLesson = () => {
  // Roll and move: the roll, three pawn moves, next.
  send('enter', 'enter', 'enter', 'enter', 'enter', 'enter', 'enter', 'enter');
  // Dice choose the pieces: the roll, the knight's leap, next.
  send('enter', 'enter', 'enter', 'enter');
  // Clear the way: the roll, three moves, next.
  send('enter', 'enter', 'enter', 'enter', 'enter', 'enter', 'enter', 'enter');
  // When nothing can move: the roll, the pass, next.
  send('enter', 'enter', 'enter');
  // Taking a piece: the roll, the rook takes the pawn, next.
  send('enter', 'enter', 'enter', 'enter');
  // Taking the king: the roll, the rook takes the king.
  send('enter', 'enter', 'enter');
};

// The game the app has saved, if any.
const savedGame = () =>
  new MmkvSnapshotStore<Game>({
    key: 'dicechess-tv.game.v2',
    decode: decodeGame,
  }).read();

test('the closing screen offers a first game, or the main menu', () => {
  let state = initialTutorial();
  for (let i = 0; i < TUTORIAL.length; i++)
    state = tutorialReducer(solve(state), 'select');
  assert.ok(state.finished);
  assert.deepEqual(
    CLOSING_CHOICES.map(({ label }) => label),
    ['Play Rolly', 'Play a friend', 'Main menu'],
  );
  // Rolly, the easiest opponent, with the player as White, who rolls first.
  assert.equal(state.choice, 0);
  const rolly = tutorialReducer(state, 'select');
  assert.ok(rolly.exit);
  assert.deepEqual(rolly.next, { mode: 'random', colour: 'w' });

  // The arrows walk the choices and wrap, as in a menu.
  const friend = tutorialReducer(state, 'down');
  assert.equal(friend.choice, 1);
  assert.equal(tutorialReducer(friend, 'up').choice, 0);
  assert.equal(tutorialReducer(state, 'up').choice, 2);
  assert.equal(tutorialReducer(state, 'right').choice, 1);
  assert.equal(tutorialReducer(state, 'left').choice, 2);
  assert.deepEqual(tutorialReducer(friend, 'select').next, {
    mode: 'hotseat',
    colour: 'random',
  });

  // Main menu starts no game, and nor do Back and Menu, from any choice.
  const menu = tutorialReducer(tutorialReducer(state, 'up'), 'select');
  assert.ok(menu.exit);
  assert.equal(menu.next, null);
  for (const key of ['back', 'menu'] as const) {
    const left = tutorialReducer(friend, key);
    assert.ok(left.exit);
    assert.equal(left.next, null);
  }
});

test('the last lesson says finish, and the closing screen has choices, not dice', () => {
  reset();
  const { root } = launch();
  send('down', 'down', 'enter');
  playEveryLesson();
  assert.match(text(root), /Lesson 6 of 6/);
  assert.match(text(root), /Done\. OK: finish · Back: leave/);

  send('enter');
  assert.match(text(root), /That is the whole game/);
  assert.match(text(root), /All lessons done/);
  assert.match(text(root), /use dice too/);
  assert.equal(root.findAllByType(Dice as never).length, 0);
  // The choices say what OK does, so there is no hint.
  assert.deepEqual(
    optionViews(root).map(({ label }) => label),
    ['Play Rolly', 'Play a friend', 'Main menu'],
  );
  assert.equal(focusedLabel(root), 'Play Rolly');
  assert.doesNotMatch(text(root), /OK: /);
  send('down');
  assert.equal(focusedLabel(root), 'Play a friend');
  send('back');
});

test('Play Rolly at the end of the tutorial starts a game against Rolly, as White', () => {
  reset();
  const { root } = launch();
  send('down', 'down', 'enter');
  playEveryLesson();
  send('enter', 'enter');
  assert.doesNotMatch(text(root), TUTORIAL_OPEN);
  const game = savedGame();
  assert.equal(game?.mode, 'random');
  assert.equal(game?.human, 'w');
  // The player rolls first.
  assert.equal(game?.phase, 'roll');
  assert.match(text(root), /White to play · you/);
  assert.match(text(root), /OK: roll three dice/);
});

test('Play a friend at the end of the tutorial starts a hotseat game', () => {
  reset();
  const { root } = launch();
  send('down', 'down', 'enter');
  playEveryLesson();
  send('enter', 'down', 'enter');
  assert.doesNotMatch(text(root), TUTORIAL_OPEN);
  assert.equal(savedGame()?.mode, 'hotseat');
  assert.match(text(root), /HOT SEAT · TURN 1/);
  assert.match(text(root), /OK: roll three dice/);
});

test('Main menu at the end of the tutorial returns home and starts nothing', () => {
  reset();
  const { root } = launch();
  send('down', 'down', 'enter');
  playEveryLesson();
  // Up from the first choice wraps to the last.
  send('enter', 'up', 'enter');
  assert.doesNotMatch(text(root), TUTORIAL_OPEN);
  assert.equal(focusedLabel(root), 'New Hot Seat game');
  assert.equal(savedGame(), null);
});

test('over a game in play, a game chosen at the end of the tutorial asks first', () => {
  reset();
  launch();
  // A hotseat game with its first roll made is worth resuming.
  send('enter', 'enter');
  const before = JSON.stringify(savedGame());
  // On the next launch the home screen offers Resume game first.
  const { root } = launch();
  send('down', 'down', 'down', 'enter');
  assert.match(text(root), TUTORIAL_OPEN);
  playEveryLesson();
  send('enter', 'enter');
  assert.match(text(root), /Replace this game\?/);
  assert.equal(focusedLabel(root), 'Cancel');

  // Cancel keeps the game, and the home screen waits on the option that would
  // have started the new one.
  send('enter');
  assert.equal(JSON.stringify(savedGame()), before);
  assert.equal(focusedLabel(root), 'Play the computer');

  // Yes replaces it with the game chosen: Rolly, as White. Learn to play is the
  // next option down.
  send('down', 'enter');
  assert.match(text(root), TUTORIAL_OPEN);
  playEveryLesson();
  send('enter', 'enter', 'down', 'enter');
  const game = savedGame();
  assert.equal(game?.mode, 'random');
  assert.equal(game?.human, 'w');
});

test('the tutorial forwards held repeats to the same destination boundary rule', () => {
  const game = rollGame(newGame('hotseat', 'wrap-lesson'), [5, 4, 2]);
  const selected = {
    ...initialTutorial(),
    game,
    focus: { cursor: 'c3' as Square, selected: 'b1' as Square },
  };
  assert.equal(
    tutorialReducer(selected, { key: 'right', repeat: true }).focus.cursor,
    'c3',
  );
  assert.equal(tutorialReducer(selected, { key: 'right' }).focus.cursor, 'a3');
});

// The matchup header in the gameplay HUD (#156, #168, #213): each side where it
// sits on the board, a badge for the side to move framed in the turn colour
// rather than the focus style, the bot's block with no frame and never dimmed,
// its level and thinking status, and where the bot and the host speak.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import renderer, { act } from 'react-test-renderer';
import {
  DIALOGUE_HEIGHT,
  HOST_HEIGHT,
  HOST_PORTRAIT,
  Matchup,
  PORTRAIT,
  type MatchupProps,
} from '../src/Matchup';
import { THEME } from '../src/theme';
import { FACES } from '../src/faces';
import { FACE_OF, portraitPath } from '../src/Portrait';
import { newGame, type Game } from '../../src/core/game';
import { isHost, styleOf, type Instance } from './support';

const mount = (props: MatchupProps): renderer.ReactTestRenderer => {
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(React.createElement(Matchup, props));
  });
  return tree;
};

// The host element with a testID: the stubs pass it on from their component.
const byTestId = (root: Instance, id: string): Instance => {
  const match = root.find(
    (node) => typeof node.type === 'string' && node.props.testID === id,
  );
  assert.ok(match, `expected element with testID="${id}"`);
  return match;
};

const texts = (node: Instance): string[] =>
  node
    .findAll((each) => isHost(each, 'Text'))
    .map((each) => String(each.props.children));

// The badges from top to bottom.
const badges = (root: Instance): string[] =>
  root
    .findAll(
      (node) =>
        isHost(node, 'View') && /-badge$/.test(String(node.props.testID)),
    )
    .map((node) => texts(node)[0]);

// Whether anything in a badge or block, itself included, is drawn dimmed.
const dimmed = (node: Instance): boolean =>
  node.findAll(
    (each) => isHost(each, 'View') && Number(styleOf(each).opacity ?? 1) < 1,
  ).length > 0;
const assertToMove = (badge: Instance) => {
  assert.equal(styleOf(badge).borderColor, THEME.turn);
  assert.ok(!dimmed(badge));
};
const assertWaiting = (badge: Instance) => {
  assert.notEqual(styleOf(badge).borderColor, THEME.turn);
  assert.ok(dimmed(badge), 'the waiting side dims');
};
// The bot's dialogue block stands on the panel as it is (#213): no frame, and
// in full colour whoever is to move.
const assertPlain = (block: Instance) => {
  const style = styleOf(block);
  assert.equal(style.borderWidth, undefined);
  assert.equal(style.backgroundColor, undefined);
  assert.ok(!dimmed(block), 'the bot never dims');
};

test('renders player and opponent badges with initial turn on White', () => {
  const tree = mount({ game: newGame('aggressive', 'game-1'), side: 'w' });

  const player = byTestId(tree.root, 'player-badge');
  const opponent = byTestId(tree.root, 'opponent-badge');
  assert.deepEqual(texts(player), ['YOU', 'White']);
  assert.deepEqual(texts(opponent), ['RAMPAGE', 'Hard']);
  assertToMove(player);
  assertPlain(opponent);
  assert.deepEqual(badges(tree.root), ['RAMPAGE', 'YOU']);
});

test('the bot’s block shows its portrait, or its emoji face when the build has none (dicechess-assets#31, #213)', () => {
  const tree = mount({ game: newGame('greedy', 'game-1'), side: 'w' });
  const opponent = byTestId(tree.root, 'opponent-badge');
  const [portrait] = opponent.findAll((node) => isHost(node, 'Image'));
  assert.equal(portrait.props.source.uri, portraitPath('grabby', 'card'));
  assert.deepEqual(portrait.props.style, { width: PORTRAIT, height: PORTRAIT });
  act(() => portrait.props.onError());
  assert.equal(opponent.findAll((node) => isHost(node, 'Image')).length, 0);
  assert.equal(opponent.findAllByType(FACES[FACE_OF.greedy]).length, 1);
  // The person's badge keeps its king.
  const player = byTestId(tree.root, 'player-badge');
  assert.equal(player.findAll((node) => isHost(node, 'Image')).length, 0);
});

test('on the bot’s turn the person’s badge waits, and the bot looks the same (#213)', () => {
  const tree = mount({ game: newGame('aggressive', 'game-2'), side: 'b' });

  assertWaiting(byTestId(tree.root, 'player-badge'));
  assertPlain(byTestId(tree.root, 'opponent-badge'));
});

test('no badge wears the focus style, which is the cursor and menu items', () => {
  for (const mode of ['hotseat', 'random', 'aggressive'] as const)
    for (const side of ['w', 'b'] as const) {
      const tree = mount({ game: newGame(mode, `focus-${mode}`), side });
      for (const id of ['player-badge', 'opponent-badge']) {
        const style = styleOf(byTestId(tree.root, id));
        assert.notEqual(style.borderColor, THEME.cursor, `${mode} ${id}`);
        assert.notEqual(
          style.backgroundColor,
          THEME.focusFill,
          `${mode} ${id}`,
        );
      }
    }
});

test('bot shows Thinking… status when it owes a move', () => {
  const tree = mount({
    game: newGame('aggressive', 'game-3'),
    side: 'b',
    thinking: true,
  });

  const opponent = byTestId(tree.root, 'opponent-badge');
  assert.equal(byTestId(opponent, 'bot-status').props.children, 'Thinking…');
});

test('reflects difficulty pips for each bot opponent', () => {
  for (const [mode, expectedFilled] of [
    ['random', 1],
    ['greedy', 2],
    ['aggressive', 3],
  ] as const) {
    const tree = mount({ game: newGame(mode, `game-${mode}`), side: 'w' });
    const opponent = byTestId(tree.root, 'opponent-badge');
    const filled = opponent.findAll(
      (node) => isHost(node, 'View') && node.props.testID === 'pip-filled',
    );
    assert.equal(filled.length, expectedFilled, `pips for ${mode}`);
  }
});

test('the person playing Black still sits at the bottom, as the board turns', () => {
  const game = newGame('greedy', 'game-black', undefined, 'b');
  const tree = mount({ game, side: 'b' });

  const player = byTestId(tree.root, 'player-badge');
  assert.deepEqual(texts(player), ['YOU', 'Black']);
  assertToMove(player);
  assert.deepEqual(badges(tree.root), ['GRABBY', 'YOU']);
});

test('renders Hotseat mode with Player 1 and Player 2 badges', () => {
  const tree = mount({ game: newGame('hotseat', 'game-hotseat'), side: 'w' });

  const player = byTestId(tree.root, 'player-badge');
  const opponent = byTestId(tree.root, 'opponent-badge');
  assert.deepEqual(texts(player), ['PLAYER 1', 'White']);
  assert.deepEqual(texts(opponent), ['PLAYER 2', 'Black']);
  assertToMove(player);
  assertWaiting(opponent);
  assert.deepEqual(badges(tree.root), ['PLAYER 2', 'PLAYER 1']);
});

test('in hotseat the badges follow the turned board', () => {
  // Black to move with the board turned to it (#120): Black's pieces are at
  // the bottom, and so is Player 2.
  const tree = mount({
    game: newGame('hotseat', 'game-turned'),
    side: 'b',
    flipped: true,
  });

  assert.deepEqual(badges(tree.root), ['PLAYER 1', 'PLAYER 2']);
  assertToMove(byTestId(tree.root, 'opponent-badge'));
});

test('neither badge is highlighted when the game has ended', () => {
  const ended = (mode: 'random' | 'hotseat'): Game => ({
    ...newGame(mode, 'game-ended'),
    phase: 'ended',
    result: { reason: 'king-captured', winner: 'w' },
  });
  const hotseat = mount({ game: ended('hotseat'), side: 'w' });
  assertWaiting(byTestId(hotseat.root, 'player-badge'));
  assertWaiting(byTestId(hotseat.root, 'opponent-badge'));
  // Against the bot the person's badge waits, and the bot looks the same.
  const bot = mount({ game: ended('random'), side: 'w' });
  assertWaiting(byTestId(bot.root, 'player-badge'));
  assertPlain(byTestId(bot.root, 'opponent-badge'));
});

const bubbleNode = (line: string) =>
  React.createElement('Text', { testID: 'test-bubble' }, line);
const turnLine = (line: string) => React.createElement('Text', null, line);

test('the bot speaks beside its portrait, and the turn line stays under the block (#213)', () => {
  const tree = mount({
    game: newGame('aggressive', 'game-bubble'),
    side: 'b',
    header: turnLine('TURN 3'),
    speechBubble: bubbleNode('Your king is in my sights!'),
  });

  const block = byTestId(tree.root, 'opponent-badge');
  const zone = byTestId(block, 'speech-zone');
  assert.deepEqual(texts(zone), ['Your king is in my sights!']);
  // The turn line is not hidden while the bot speaks: it stands under the
  // block, outside it.
  assert.deepEqual(texts(byTestId(tree.root, 'turn-line')), ['TURN 3']);
  assert.equal(
    block.findAll((node) => node.props?.testID === 'turn-line').length,
    0,
  );
});

test('the dialogue block keeps its height whether the bot speaks or not (#213)', () => {
  const heights = [
    undefined,
    bubbleNode('Mine! I’ll take that, thank you.'),
  ].map((speechBubble) => {
    const tree = mount({
      game: newGame('greedy', 'game-height'),
      side: 'w',
      header: turnLine('TURN 2'),
      speechBubble,
    });
    return styleOf(byTestId(tree.root, 'opponent-badge')).height;
  });
  assert.deepEqual(heights, [DIALOGUE_HEIGHT, DIALOGUE_HEIGHT]);
});

test('the bot keeps its look whoever is to move, speaking or not, and thinking (#213)', () => {
  for (const side of ['w', 'b'] as const)
    for (const speechBubble of [undefined, bubbleNode('Boop! Mine now!')]) {
      const tree = mount({
        game: newGame('random', 'game-plain'),
        side,
        thinking: side === 'b',
        speechBubble,
      });
      assertPlain(byTestId(tree.root, 'opponent-badge'));
    }
});

test('hotseat has no dialogue block: the turn line stands under the top badge', () => {
  const tree = mount({
    game: newGame('hotseat', 'game-quiet'),
    side: 'w',
    header: turnLine('HOT SEAT · TURN 1'),
  });

  assert.equal(
    tree.root.findAll((node) => node.props?.testID === 'speech-zone').length,
    0,
  );
  assert.deepEqual(texts(byTestId(tree.root, 'turn-line')), [
    'HOT SEAT · TURN 1',
  ]);
});

test('the host shows above the bottom badge while she speaks, over the free space (#213)', () => {
  const quiet = mount({
    game: newGame('hotseat', 'game-host'),
    side: 'w',
    children: turnLine('White to play'),
  });
  assert.equal(
    quiet.root.findAll((node) => node.props?.testID === 'host-block').length,
    0,
  );

  const tree = mount({
    game: newGame('hotseat', 'game-host'),
    side: 'w',
    children: turnLine('White to play'),
    hostBubble: bubbleNode('Now pass the remote over!'),
  });
  const center = byTestId(tree.root, 'matchup-center');
  const block = byTestId(center, 'host-block');
  // Placed over the foot of the centre, so nothing in it moves.
  assert.equal(styleOf(block).position, 'absolute');
  assert.equal(styleOf(block).height, HOST_HEIGHT);
  // The default host's: Prowla the cat.
  const [portrait] = block.findAll((node) => isHost(node, 'Image'));
  assert.equal(portrait.props.source.uri, portraitPath('cat', 'card'));
  assert.deepEqual(texts(block), ['Now pass the remote over!']);
  assert.deepEqual(texts(center), [
    'White to play',
    'Now pass the remote over!',
  ]);
});

test('Prowla, hosting, shows her own portrait, and keeps its place in a build without the portraits (#258)', () => {
  const tree = mount({
    game: newGame('hotseat', 'game-prowla'),
    side: 'w',
    children: turnLine('White to play'),
    hostBubble: bubbleNode('Paw it over.'),
    host: 'prowla',
  });
  const block = byTestId(tree.root, 'host-block');
  const [portrait] = block.findAll((node) => isHost(node, 'Image'));
  assert.equal(portrait.props.source.uri, portraitPath('cat', 'card'));
  // She has no emoji face: the place stays empty, the size of her portrait,
  // so the bubble does not move.
  act(() => portrait.props.onError());
  assert.equal(block.findAll((node) => isHost(node, 'Image')).length, 0);
  const empty = byTestId(block, 'portrait-missing-cat');
  assert.equal(styleOf(empty).width, HOST_PORTRAIT);
  assert.equal(styleOf(empty).height, HOST_PORTRAIT);
  assert.deepEqual(texts(block), ['Paw it over.']);
});

test('renders center children between the badges, anchored at the top', () => {
  const tree = mount({
    game: newGame('aggressive', 'game-children'),
    side: 'w',
    children: React.createElement('Text', null, 'White to play · you'),
  });

  const center = byTestId(tree.root, 'matchup-center');
  assert.deepEqual(texts(center), ['White to play · you']);
  assert.notEqual(styleOf(center).justifyContent, 'center');
});

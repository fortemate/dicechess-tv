// Tests for the useBotVoice hook (#158): voice line triggers, auto-dismiss
// timing (2800 ms), reset on new game, and silence in hotseat mode.
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import renderer, { act } from 'react-test-renderer';
import {
  useBotVoice,
  DISMISS_DELAY_MS,
  type UseBotVoiceOptions,
} from '../src/useBotVoice';
import { newGame, type Game } from '../../src/core/game';
import type { Level } from '../../src/core/danger';
import type { VoiceLine } from '../../src/core/botVoice';

type HarnessProps = {
  game: Game;
  dangerLevel?: Level;
  options?: UseBotVoiceOptions;
};

const setupHarness = () => {
  let latestLine: VoiceLine | null = null;
  const Harness = ({ game, dangerLevel, options }: HarnessProps) => {
    latestLine = useBotVoice(game, dangerLevel, options);
    return null;
  };
  return {
    getLine: () => latestLine,
    Harness,
  };
};

test('triggers intro voice line on a fresh bot game and auto-dismisses after 2800 ms', () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    const { getLine, Harness } = setupHarness();
    const game = newGame('aggressive', 'game-intro');

    act(() => {
      renderer.create(<Harness game={game} />);
    });

    const introLine = getLine();
    assert.ok(introLine, 'expected intro voice line on fresh bot game');
    assert.equal(introLine.bot, 'aggressive');
    assert.equal(introLine.event, 'intro');

    // Before timer expires, line remains visible
    act(() => {
      mock.timers.tick(2000);
    });
    assert.equal(getLine(), introLine);

    // After 2800 ms total, line auto-dismisses to null
    act(() => {
      mock.timers.tick(800);
    });
    assert.equal(getLine(), null);
  } finally {
    mock.timers.reset();
  }
});

test('supports custom timeoutMs and invokes onVoiceLine callback', () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    const { getLine, Harness } = setupHarness();
    const game = newGame('greedy', 'game-custom-timeout');
    const calls: VoiceLine[] = [];

    act(() => {
      renderer.create(
        <Harness
          game={game}
          options={{
            timeoutMs: 1500,
            onVoiceLine: (line) => calls.push(line),
          }}
        />,
      );
    });

    assert.equal(calls.length, 1);
    assert.equal(calls[0].event, 'intro');
    assert.ok(getLine());

    // Advance 1400 ms: still active
    act(() => {
      mock.timers.tick(1400);
    });
    assert.ok(getLine());

    // Advance remaining 100 ms: dismissed
    act(() => {
      mock.timers.tick(100);
    });
    assert.equal(getLine(), null);
  } finally {
    mock.timers.reset();
  }
});

test('stays silent in hotseat mode and clears active line on mode switch', () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    const { getLine, Harness } = setupHarness();
    const hotseatGame = newGame('hotseat', 'game-hotseat');

    let tree!: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(<Harness game={hotseatGame} />);
    });

    assert.equal(
      getLine(),
      null,
      'hotseat should never trigger bot voice lines',
    );

    // Switch to bot game: intro triggers
    const botGame = newGame('random', 'game-bot');
    act(() => {
      tree.update(<Harness game={botGame} />);
    });
    assert.ok(getLine(), 'bot game triggers intro');

    // Switch back to hotseat: line immediately cleared
    act(() => {
      tree.update(<Harness game={hotseatGame} />);
    });
    assert.equal(getLine(), null, 'switching to hotseat clears active line');
  } finally {
    mock.timers.reset();
  }
});

test('triggers critical danger voice line during gameplay', () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    const { getLine, Harness } = setupHarness();
    const game = newGame('aggressive', 'game-danger');

    let tree!: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(<Harness game={game} dangerLevel="calm" />);
    });

    // Dismiss intro first
    act(() => {
      mock.timers.tick(DISMISS_DELAY_MS);
    });
    assert.equal(getLine(), null);

    // In a later turn (respecting turn cooldown), king is in critical danger
    const gameTurn3: Game = { ...game, turn: 3, revision: 4 };
    act(() => {
      tree.update(<Harness game={gameTurn3} dangerLevel="critical" />);
    });

    const dangerLine = getLine();
    assert.ok(dangerLine, 'expected danger voice line');
    assert.equal(dangerLine.event, 'threat');

    // Auto-dismisses
    act(() => {
      mock.timers.tick(DISMISS_DELAY_MS);
    });
    assert.equal(getLine(), null);
  } finally {
    mock.timers.reset();
  }
});

test('resets voice state and triggers new intro on rematch or new game ID', () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    const { getLine, Harness } = setupHarness();
    const game1 = newGame('aggressive', 'game-1');

    let tree!: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(<Harness game={game1} />);
    });

    const firstIntro = getLine();
    assert.ok(firstIntro);

    // Advance half-way through the timeout
    act(() => {
      mock.timers.tick(1000);
    });

    // Rematch starts with new ID
    const game2 = newGame('aggressive', 'game-2');
    act(() => {
      tree.update(<Harness game={game2} />);
    });

    const secondIntro = getLine();
    assert.ok(secondIntro);
    // Spoken aloud, the same opening twice in a row would be heard (#159).
    assert.notEqual(secondIntro.id, firstIntro.id);

    // After 1000 ms, second intro should still be visible because timer was reset
    act(() => {
      mock.timers.tick(1000);
    });
    assert.equal(getLine(), secondIntro);

    // After another 1800 ms (2800 ms total for game 2), it dismisses
    act(() => {
      mock.timers.tick(1800);
    });
    assert.equal(getLine(), null);
  } finally {
    mock.timers.reset();
  }
});

test('a line said aloud keeps its bubble until it has been said (#159)', () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    const { getLine, Harness } = setupHarness();
    const game = newGame('random', 'game-hold');
    act(() => {
      renderer.create(<Harness game={game} options={{ holdMs: () => 4500 }} />);
    });
    const intro = getLine();
    assert.ok(intro);
    act(() => {
      mock.timers.tick(DISMISS_DELAY_MS);
    });
    assert.equal(getLine(), intro, 'still being said');
    act(() => {
      mock.timers.tick(4500 - DISMISS_DELAY_MS);
    });
    assert.equal(getLine(), null);
  } finally {
    mock.timers.reset();
  }
});

test('cleans up active timers when unmounted', () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    const { getLine, Harness } = setupHarness();
    const game = newGame('aggressive', 'game-unmount');

    let tree!: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(<Harness game={game} />);
    });

    assert.ok(getLine());

    const cleared = mock.method(globalThis, 'clearTimeout');
    act(() => {
      tree.unmount();
    });
    assert.equal(
      cleared.mock.callCount(),
      1,
      'unmount must cancel the dismiss timer',
    );
    cleared.mock.restore();

    act(() => {
      mock.timers.tick(DISMISS_DELAY_MS);
    });
  } finally {
    mock.timers.reset();
  }
});

test('nothing is said while the board is not on screen (#202)', () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    const { getLine, Harness } = setupHarness();
    const calls: VoiceLine[] = [];
    const game = newGame('random', 'game-behind-home');
    let tree!: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(
        <Harness
          game={game}
          options={{ live: false, onVoiceLine: (line) => calls.push(line) }}
        />,
      );
    });
    assert.equal(getLine(), null, 'no intro behind the home screen');
    assert.equal(calls.length, 0);
    act(() => tree.unmount());
  } finally {
    mock.timers.reset();
  }
});

test('a restored game in danger says its threat only once the board shows (#202)', () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    const { getLine, Harness } = setupHarness();
    const calls: VoiceLine[] = [];
    const onVoiceLine = (line: VoiceLine) => calls.push(line);
    const restored: Game = {
      ...newGame('aggressive', 'game-restored'),
      turn: 5,
      revision: 9,
    };
    let tree!: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(
        <Harness
          game={restored}
          dangerLevel="critical"
          options={{ live: false, onVoiceLine }}
        />,
      );
    });
    assert.equal(getLine(), null);
    assert.equal(calls.length, 0);
    // Resumed: the board is on screen, and the threat is said as it was.
    act(() => {
      tree.update(
        <Harness
          game={restored}
          dangerLevel="critical"
          options={{ live: true, onVoiceLine }}
        />,
      );
    });
    assert.equal(getLine()?.event, 'threat');
    assert.equal(calls.length, 1);
    act(() => tree.unmount());
  } finally {
    mock.timers.reset();
  }
});

test('the board counts as on screen unless the caller says otherwise', () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    const { getLine, Harness } = setupHarness();
    let tree!: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(
        <Harness game={newGame('greedy', 'game-default-live')} />,
      );
    });
    assert.equal(getLine()?.event, 'intro');
    act(() => tree.unmount());
  } finally {
    mock.timers.reset();
  }
});

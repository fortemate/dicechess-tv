// Thinkle says the tutorial aloud (#264): when his lines start, the order they
// come in, what cuts them, and what stops them.
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { act } from 'react-test-renderer';
import { TutorialScreen } from '../src/TutorialScreen';
import { nextLineMs, type TutorialVoice } from '../src/useTutorialVoice';
import {
  CLOSING_LINES,
  TUTORIAL,
  stepGame,
  tutorLinesAt,
} from '../../src/core/tutorial';
import type { SpokenLine } from '../src/sound';
import { fakeTimers, mount, send, text, unmount } from './support';

// His lines follow one another on the test's clock.
fakeTimers();

// A voice that records what it was asked to say, and when it was stopped.
const recorder = () => {
  const calls: string[] = [];
  const voice: TutorialVoice = {
    say: (line: SpokenLine) => calls.push(line.id),
    stopLine: () => calls.push('stop'),
  };
  return { calls, voice };
};

const open = (voice?: TutorialVoice, onExit = () => {}) =>
  mount(React.createElement(TutorialScreen, { onExit, voice }));
const tick = (ms: number) => act(() => mock.timers.tick(ms));

const [first] = TUTORIAL;
const opening = tutorLinesAt(first, stepGame(first), false);

test('the tutorial opens with his welcome, one line after another', () => {
  const { calls, voice } = recorder();
  open(voice);
  // The first line at once; each next one after the last has been said.
  assert.deepEqual(calls, [opening[0].id]);
  tick(nextLineMs(opening[0])! - 1);
  assert.deepEqual(calls, [opening[0].id]);
  tick(1);
  assert.deepEqual(calls, [opening[0].id, opening[1].id]);
  tick(nextLineMs(opening[1])!);
  assert.deepEqual(
    calls,
    opening.map((line) => line.id),
  );
  // And nothing more until the lesson moves on.
  tick(60_000);
  assert.equal(calls.length, opening.length);
});

test('a new point of the lesson cuts what he was saying', () => {
  const { calls, voice } = recorder();
  open(voice);
  // OK rolls before the welcome is over: he stops, and says the roll's lines.
  send('enter');
  const rolled = first.speech.rolled!;
  assert.deepEqual(calls, [
    opening[0].id,
    'stop',
    'thinkle_tutor_move_rolled_1',
  ]);
  // The welcome's other lines never come.
  tick(60_000);
  assert.deepEqual(calls.slice(3), ['thinkle_tutor_move_rolled_2']);
  assert.equal(rolled.length, 2);
});

test('leaving the tutorial stops him', () => {
  const { calls, voice } = recorder();
  let left = false;
  open(voice, () => {
    left = true;
  });
  send('back');
  assert.ok(left);
  unmount();
  assert.equal(calls.at(-1), 'stop');
  // No line comes after he has stopped.
  const count = calls.length;
  tick(60_000);
  assert.equal(calls.length, count);
});

test('his closing words come after the last lesson', () => {
  const ids = CLOSING_LINES.map((line) => line.id);
  assert.deepEqual(ids, [
    'thinkle_tutor_closing_1',
    'thinkle_tutor_closing_2',
    'thinkle_tutor_closing_3',
  ]);
  for (const line of CLOSING_LINES) assert.ok(nextLineMs(line)! > 0, line.id);
});

test('without a voice the tutorial is silent, and his bubble still shows', () => {
  const { root } = open(undefined);
  assert.match(text(root), /Welcome, my friend! I am Thinkle/);
});

test('every line he says has a clip, so none is skipped', () => {
  for (const step of TUTORIAL)
    for (const moment of ['opening', 'rolled', 'moved', 'done'] as const)
      for (const [i] of (step.speech[moment] ?? []).entries()) {
        const line = {
          id: `thinkle_tutor_${step.id}_${moment}_${i + 1}`,
          event: `${step.id}_${moment}` as const,
          text: '',
        };
        assert.ok(nextLineMs(line), line.id);
      }
});

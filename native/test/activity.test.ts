import { test } from 'node:test';
import assert from 'node:assert/strict';
import { activeClock, createActivity, scheduleActive } from '../src/activity';

test('work pauses synchronously and resumes only its unspent wait, once', () => {
  const activity = createActivity(true);
  const waiting: { run: () => void; wait: number }[] = [];
  let time = 0;
  let steps = 0;
  scheduleActive(
    activity,
    (run, wait) => {
      waiting.push({ run, wait });
    },
    () => steps++,
    600,
    () => time,
  );
  const old = waiting.shift()!;
  time = 200;
  activity.setActive(false);
  time = 60_000;
  old.run();
  assert.equal(steps, 0, 'a previously queued timer cannot act behind Alexa');
  activity.setActive(true);
  const resumed = waiting.shift()!;
  assert.equal(resumed.wait, 400);
  old.run();
  resumed.run();
  resumed.run();
  assert.equal(
    steps,
    1,
    'neither stale nor repeated delivery duplicates a step',
  );
});

test('inactive initial state, duplicate events and cancellation do not leak work', () => {
  const activity = createActivity(false);
  const waiting: (() => void)[] = [];
  let steps = 0;
  const cancel = scheduleActive(
    activity,
    (run) => {
      waiting.push(run);
    },
    () => steps++,
  );
  assert.equal(waiting.length, 0);
  activity.setActive(false);
  activity.setActive(true);
  activity.setActive(true);
  assert.equal(waiting.length, 1);
  cancel();
  waiting[0]();
  activity.setActive(false);
  activity.setActive(true);
  assert.equal(waiting.length, 1);
  assert.equal(steps, 0);
});

test('the search clock excludes time behind the overlay, and stops observing on disposal', () => {
  const activity = createActivity(true);
  let time = 20;
  const clock = activeClock(activity, () => time);
  time = 100;
  activity.setActive(false);
  time = 10_100;
  assert.equal(clock.now(), 100);
  activity.setActive(true);
  time = 10_150;
  assert.equal(clock.now(), 150);
  clock.dispose();
});

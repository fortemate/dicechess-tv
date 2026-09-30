// The count of the voice audition's picks (site/src/voices/results.ts, #172).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HEADER, tally } from '../site/src/voices/results.ts';

const COMMIT = '03fbddfb43eaa46f2d48f4b7993c072a1be0f706';
const csv = (...rows: string[][]) =>
  [HEADER, ...rows]
    .map((row) =>
      row.map((field) => `"${field.replace(/"/g, '""')}"`).join(','),
    )
    .join('\r\n');

test('picks are counted per bot and candidate, and a visit once', () => {
  const counts = tally(
    csv(
      ['2026-10-01', 'a', '', 'c', 'Nice, "really"', COMMIT, 'id-1'],
      ['2026-10-01', 'a', 'b', '', '', COMMIT, 'id-2'],
      ['2026-10-01', 'a', 'b', '', '', COMMIT, 'id-2'],
    ),
  );
  assert.deepEqual(Object.keys(counts), [COMMIT]);
  assert.equal(counts[COMMIT].visits, 2);
  assert.deepEqual(counts[COMMIT].picks, {
    random: { a: 2 },
    greedy: { b: 1 },
    aggressive: { c: 1 },
  });
  assert.deepEqual(counts[COMMIT].comments, ['Nice, "really"']);
});

test('another tab is refused', () => {
  assert.throws(() => tally('Received,Played on\n1,2'), /Not the voices tab/);
});

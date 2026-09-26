// The answers sheet's Apps Script (site/answers-sheet/Code.js), run outside
// Google against stand-ins for the three services it uses.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';

type Tab = { rows: unknown[][]; frozen: number };
type Reply = { text: string };

// `existing` pretends each tab already holds that many rows.
function load(existing = 0) {
  const tabs = new Map<string, Tab>();
  const sheet = (name: string) => {
    const tab = tabs.get(name) as Tab;
    return {
      // Copied into an array of this realm, so that deepEqual compares values.
      appendRow: (row: unknown[]) => void tab.rows.push([...row]),
      getLastRow: () => existing + tab.rows.length,
      // Rows that exist only in `existing` read as empty.
      getRange: (row: number, column: number, rows: number) => ({
        getValues: () =>
          Array.from({ length: rows }, (_, i) => [
            tab.rows[row - 1 + i]?.[column - 1] ?? '',
          ]),
      }),
      setFrozenRows: (rows: number) => void (tab.frozen = rows),
    };
  };
  const context: Record<string, unknown> = {
    SpreadsheetApp: {
      getActive: () => ({
        getSheetByName: (name: string) => (tabs.has(name) ? sheet(name) : null),
        insertSheet: (name: string) => {
          tabs.set(name, { rows: [], frozen: 0 });
          return sheet(name);
        },
      }),
    },
    LockService: {
      getScriptLock: () => ({ waitLock() {}, releaseLock() {} }),
    },
    ContentService: {
      MimeType: { JSON: 'application/json' },
      createTextOutput: (text: string) => ({
        text,
        setMimeType() {
          return this;
        },
      }),
    },
  };
  const code = readFileSync(
    fileURLToPath(new URL('../site/answers-sheet/Code.js', import.meta.url)),
    'utf8',
  );
  runInNewContext(code, context);
  const doPost = context.doPost as (event: unknown) => Reply;
  const post = (body: unknown) =>
    JSON.parse(
      doPost({
        postData: {
          contents: typeof body === 'string' ? body : JSON.stringify(body),
        },
      }).text,
    ).ok as boolean;
  return { post, tabs };
}

const zero = { found: 0, missed: 0, lastMove: 0, other: 0 };
const check = {
  kind: 'check',
  v: 1,
  id: '3f1c2b9e-8d4a-4c1e-9b7f-0a2d6e5c4b3a',
  vision: 'red-green',
  screen: 'phone',
  order: ['a-many', 'b-few'],
  taps: { 'a-many': [10, 12], 'b-few': [] },
  score: {
    A: { found: 2, missed: 3, lastMove: 0, other: 0 },
    B: { found: 0, missed: 1, lastMove: 0, other: 0 },
    C: zero,
  },
  website: '',
};

test('a check is appended to the check tab, under a header row', () => {
  const { post, tabs } = load();
  assert.equal(post(check), true);
  const tab = tabs.get('check') as Tab;
  assert.equal(tab.frozen, 1);
  assert.equal(tab.rows.length, 2);
  assert.deepEqual(tab.rows[0].slice(0, 4), [
    'Received',
    'Colour vision',
    'Screen',
    'A found',
  ]);
  const [received, ...row] = tab.rows[1];
  assert.equal(typeof (received as Date).getTime, 'function');
  assert.deepEqual(row.slice(0, 2), ['red-green', 'phone']);
  assert.deepEqual(row.slice(2, 14), [2, 3, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0]);
  assert.deepEqual(JSON.parse(row[14] as string), {
    order: check.order,
    taps: check.taps,
  });
  assert.equal(row[15], check.id);
});

test('the same submission sent twice is stored once', () => {
  const { post, tabs } = load();
  assert.equal(post(check), true);
  assert.equal(post(check), true);
  assert.equal(
    post({ ...check, id: '9e8d7c6b-5a4f-4e3d-8c2b-1a0f9e8d7c6b' }),
    true,
  );
  assert.equal((tabs.get('check') as Tab).rows.length, 3);
});

test('a count may reach 64 squares on every picture shown', () => {
  const { post, tabs } = load();
  const most = { ...zero, other: 128 };
  assert.equal(post({ ...check, score: { A: most, B: most, C: most } }), true);
  assert.equal((tabs.get('check') as Tab).rows.length, 2);
  const over = { ...zero, other: 129 };
  assert.equal(
    post({
      ...check,
      id: '0b1c2d3e-4f5a-4b6c-8d7e-9f0a1b2c3d4e',
      score: { ...check.score, B: over },
    }),
    false,
  );
});

test('feedback is trimmed, and text that starts like a formula stays text', () => {
  const { post, tabs } = load();
  const feedback = {
    kind: 'feedback',
    v: 1,
    id: 'c0ffee00-1234-4abc-9def-0123456789ab',
    playedOn: 'stick',
    confusing: ' =IMPORTXML("https://example.com", "//a") ',
    liked: 'The dice.',
    broke: '',
  };
  assert.equal(post(feedback), true);
  const [, ...row] = (tabs.get('feedback') as Tab).rows[1];
  assert.deepEqual(row, [
    'stick',
    `'=IMPORTXML("https://example.com", "//a")`,
    'The dice.',
    '',
    feedback.id,
  ]);
});

test('a filled-in honeypot is thanked and dropped', () => {
  const { post, tabs } = load();
  assert.equal(post({ ...check, website: 'https://example.com' }), true);
  assert.equal(tabs.size, 0);
});

test('anything the pages could not have sent is refused', () => {
  const { post, tabs } = load();
  const feedback = { kind: 'feedback', v: 1, id: check.id };
  const refused = [
    '{',
    'null',
    { kind: 'survey', v: 1, id: check.id },
    { ...check, id: undefined },
    { ...check, id: 'not-a-random-id' },
    { ...check, id: check.id.toUpperCase() },
    { ...check, v: 2 },
    { ...check, vision: 'purple' },
    { ...check, screen: 'watch' },
    { ...check, score: { ...check.score, B: { ...zero, found: -1 } } },
    { ...check, score: { ...check.score, C: { ...zero, other: 1.5 } } },
    { ...check, score: { A: zero, B: zero } },
    { ...check, order: [] },
    { ...check, order: ['z-many'] },
    { ...check, order: ['a-many', 'a-many'] },
    { ...check, taps: { 'c-few': [1] } },
    { ...check, taps: { 'a-many': [64] } },
    { ...check, taps: [] },
    { ...feedback, liked: 'x'.repeat(1001) },
    { ...feedback, playedOn: 'mars', liked: 'Yes.' },
    { ...feedback, confusing: '  ', liked: '', broke: '' },
    { ...feedback, liked: 42 },
  ];
  for (const body of refused) {
    assert.equal(post(body), false, JSON.stringify(body).slice(0, 80));
  }
  assert.equal(tabs.size, 0);
});

test('a full tab takes no more rows', () => {
  const { post, tabs } = load(5000);
  assert.equal(post(check), false);
  assert.deepEqual(
    (tabs.get('check') as Tab).rows.map((row) => row[0]),
    ['Received'],
  );
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_MARKS,
  MARKS,
  PALETTES,
  PRESETS,
  formatBench,
  isDefault,
  parseBench,
  presetOf,
  type Bench,
} from '../src/marks.ts';

test('the bare address is the television as it is', () => {
  const bench = parseBench('');
  assert.deepEqual(bench.marks, DEFAULT_MARKS);
  assert.equal(bench.cvd, 'none');
  assert.equal(bench.controls, true);
  assert.equal(isDefault(bench.marks), true);
  assert.equal(formatBench(bench), '');
});

test('a variant survives the round trip through the address', () => {
  const bench: Bench = {
    marks: {
      movable: 'corners',
      selected: 'lift',
      destination: 'fill',
      cursor: 'two-tone',
      lastMove: 'none',
      palette: 'okabe-ito',
    },
    cvd: 'deuteranopia',
    controls: false,
  };
  const search = formatBench(bench);
  assert.equal(
    search,
    '?movable=corners&selected=lift&dest=fill&cursor=two-tone&last=none&palette=okabe-ito&cvd=deuteranopia&ui=0',
  );
  assert.deepEqual(parseBench(search), bench);
});

test('only what differs from the television is written', () => {
  const bench = parseBench('?movable=fill-corners');
  assert.equal(formatBench(bench), '?movable=fill-corners');
  assert.equal(isDefault(bench.marks), false);
});

test('an unknown value falls back to the television rather than breaking', () => {
  const bench = parseBench('?movable=sparkles&cvd=x-ray&palette=');
  assert.deepEqual(bench.marks, DEFAULT_MARKS);
  assert.equal(bench.cvd, 'none');
});

test('every preset names only known marks, and no two presets are the same', () => {
  const seen = new Set<string>();
  for (const [name, marks] of Object.entries(PRESETS)) {
    for (const [mark, value] of Object.entries(marks)) {
      const options: readonly string[] = MARKS[mark as keyof typeof MARKS];
      assert.ok(options.includes(value), `${name}: ${mark}=${value}`);
    }
    const full = { ...DEFAULT_MARKS, ...marks };
    const key = JSON.stringify(full);
    assert.ok(!seen.has(key), `${name} repeats another preset`);
    seen.add(key);
    assert.equal(presetOf(full), name);
  }
});

test('the check variants are A, B and C of #108', () => {
  assert.equal(presetOf({ ...DEFAULT_MARKS }), 'TV today (check A)');
  assert.equal(
    presetOf({ ...DEFAULT_MARKS, movable: 'fill-corners' }),
    'Check B: fill + corners',
  );
  assert.equal(
    presetOf({ ...DEFAULT_MARKS, movable: 'corners' }),
    'Check C: corners',
  );
});

test('the tv palette is the television theme', async () => {
  const { THEME } = await import('../../native/src/theme.ts');
  const tv = PALETTES.tv;
  assert.equal(tv.movable, THEME.movable);
  assert.equal(tv.selected, THEME.selected);
  assert.equal(tv.destination, THEME.destination);
  assert.equal(tv.cursor, THEME.cursor);
  assert.equal(tv.lastMove, THEME.lastMove);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  COMPARE_DESTINATIONS,
  COMPARE_MOVABLE,
  DEFAULT_MARKS,
  INITIAL_COMPARE_CURSORS,
  MARKS,
  PALETTES,
  PRESETS,
  SHARES_CURSOR_FRAME,
  formatBench,
  isDefault,
  parseBench,
  presetOf,
  stepCompareCursors,
  stepShortcut,
  type Bench,
} from '../src/marks.ts';

test('the bare address is the television as it is', () => {
  const bench = parseBench('');
  assert.deepEqual(bench.marks, DEFAULT_MARKS);
  assert.equal(bench.cvd, 'none');
  assert.equal(bench.view, 'game');
  assert.equal(bench.controls, true);
  assert.equal(isDefault(bench.marks), true);
  assert.equal(formatBench(bench), '');
});

test('a variant survives the round trip through the address', () => {
  const bench: Bench = {
    marks: {
      movable: 'pedestal',
      selected: 'warm-pedestal',
      destination: 'dot-ringed',
      target: 'bullseye',
      cursor: 'two-tone-bold',
      lastMove: 'none',
      palette: 'okabe-ito',
    },
    cvd: 'deuteranopia',
    view: 'compare',
    controls: false,
  };
  const search = formatBench(bench);
  assert.equal(
    search,
    '?movable=pedestal&selected=warm-pedestal&dest=dot-ringed&target=bullseye&cursor=two-tone-bold&last=none&palette=okabe-ito&cvd=deuteranopia&view=compare&ui=0',
  );
  assert.deepEqual(parseBench(search), bench);
});

test('only what differs from the television is written', () => {
  const bench = parseBench('?movable=fill-corners');
  assert.equal(formatBench(bench), '?movable=fill-corners');
  assert.equal(isDefault(bench.marks), false);
});

test('an unknown value falls back to the television rather than breaking', () => {
  const bench = parseBench('?movable=sparkles&cvd=x-ray&view=vr&palette=');
  assert.deepEqual(bench.marks, DEFAULT_MARKS);
  assert.equal(bench.cvd, 'none');
  assert.equal(bench.view, 'game');
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

test('the candidate highlight presets decouple the picked-up piece from the cursor frame', () => {
  const nonCursorSelected: readonly string[] = [
    'raised',
    'warm-frame',
    'warm-pedestal',
    'lift',
  ];
  for (const name of [
    'Standard (enhanced)',
    'Focus fill',
    'Colour-blind (Okabe-Ito)',
    'High contrast',
  ]) {
    const marks = { ...DEFAULT_MARKS, ...PRESETS[name] };
    assert.ok(
      !SHARES_CURSOR_FRAME.includes(marks.selected),
      `${name}: selected=${marks.selected} still shares the cursor frame`,
    );
    assert.ok(
      nonCursorSelected.includes(marks.selected),
      `${name}: selected=${marks.selected} is not a decoupled selected style`,
    );
    assert.notEqual(marks.target, 'cursor-only', name);
    assert.notEqual(marks.cursor, 'frame', name);
  }
});

test('keyboard shortcuts toggle compare view and cycle vision filter and presets', () => {
  const initial = parseBench('');
  const compared = stepShortcut(initial, 'b');
  assert.equal(compared?.view, 'compare');
  assert.equal(stepShortcut(compared!, 'B')?.view, 'game');

  const protan = stepShortcut(initial, 'c');
  assert.equal(protan?.cvd, 'protanopia');

  const nextPreset = stepShortcut(initial, 'v');
  assert.equal(presetOf(nextPreset!.marks), 'Standard (enhanced)');
  assert.equal(stepShortcut(initial, 'ArrowUp'), null);
});

test('arrow keys in compare view advance the cursor on both boards at once', () => {
  assert.equal(COMPARE_MOVABLE.includes(INITIAL_COMPARE_CURSORS.step1), true);
  assert.equal(
    COMPARE_DESTINATIONS.includes(INITIAL_COMPARE_CURSORS.step2),
    true,
  );
  const next = stepCompareCursors(INITIAL_COMPARE_CURSORS, 'right');
  assert.notEqual(next.step1, INITIAL_COMPARE_CURSORS.step1);
  assert.notEqual(next.step2, INITIAL_COMPARE_CURSORS.step2);
  assert.equal(COMPARE_MOVABLE.includes(next.step1), true);
  assert.equal(COMPARE_DESTINATIONS.includes(next.step2), true);
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
